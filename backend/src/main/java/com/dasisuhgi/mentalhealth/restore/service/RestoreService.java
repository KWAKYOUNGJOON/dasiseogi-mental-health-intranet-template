package com.dasisuhgi.mentalhealth.restore.service;

import com.dasisuhgi.mentalhealth.audit.entity.ActivityActionType;
import com.dasisuhgi.mentalhealth.audit.entity.ActivityTargetType;
import com.dasisuhgi.mentalhealth.audit.service.ActivityLogService;
import com.dasisuhgi.mentalhealth.common.error.AppException;
import com.dasisuhgi.mentalhealth.common.security.AccessPolicyService;
import com.dasisuhgi.mentalhealth.common.session.SessionUser;
import com.dasisuhgi.mentalhealth.common.time.SeoulDateTimeSupport;
import com.dasisuhgi.mentalhealth.restore.dto.RestoreDetectedItemResponse;
import com.dasisuhgi.mentalhealth.restore.dto.RestoreDetailResponse;
import com.dasisuhgi.mentalhealth.restore.dto.RestoreUploadResponse;
import com.dasisuhgi.mentalhealth.restore.entity.RestoreHistory;
import com.dasisuhgi.mentalhealth.restore.entity.RestoreStatus;
import com.dasisuhgi.mentalhealth.restore.repository.RestoreHistoryRepository;
import com.dasisuhgi.mentalhealth.user.entity.User;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.OffsetDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Enumeration;
import java.util.HashSet;
import java.util.HexFormat;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.zip.ZipEntry;
import java.util.zip.ZipException;
import java.util.zip.ZipFile;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import org.springframework.web.multipart.MultipartFile;

@Service
public class RestoreService {
    private static final String FORMAT_VERSION = "FULL_BACKUP_ZIP_V1";
    private static final long MAX_UPLOAD_SIZE_BYTES = 500L * 1024L * 1024L;
    private static final DateTimeFormatter FILE_FORMAT = DateTimeFormatter.ofPattern("yyyyMMdd-HHmmss");

    private final RestoreHistoryRepository restoreHistoryRepository;
    private final AccessPolicyService accessPolicyService;
    private final ActivityLogService activityLogService;
    private final ObjectMapper objectMapper;
    private final String restoreRootPath;
    private final long maxUploadSizeBytes;

    public RestoreService(
            RestoreHistoryRepository restoreHistoryRepository,
            AccessPolicyService accessPolicyService,
            ActivityLogService activityLogService,
            ObjectMapper objectMapper,
            @Value("${app.restore.root-path:./tmp/restores}") String restoreRootPath,
            @Value("${app.restore.max-upload-size-bytes:524288000}") long maxUploadSizeBytes
    ) {
        this.restoreHistoryRepository = restoreHistoryRepository;
        this.accessPolicyService = accessPolicyService;
        this.activityLogService = activityLogService;
        this.objectMapper = objectMapper;
        this.restoreRootPath = restoreRootPath;
        this.maxUploadSizeBytes = maxUploadSizeBytes > 0 ? maxUploadSizeBytes : MAX_UPLOAD_SIZE_BYTES;
    }

    @Transactional(readOnly = true)
    public RestoreDetailResponse getRestoreDetail(Long restoreId, SessionUser sessionUser) {
        User currentUser = accessPolicyService.getCurrentUser(sessionUser);
        if (!accessPolicyService.isAdmin(currentUser)) {
            throw new AppException(HttpStatus.FORBIDDEN, "RESTORE_DETAIL_FORBIDDEN", "복원 검증 이력을 조회할 권한이 없습니다.");
        }

        RestoreHistory history = restoreHistoryRepository.findById(restoreId)
                .orElseThrow(() -> new AppException(HttpStatus.NOT_FOUND, "RESTORE_HISTORY_NOT_FOUND", "복원 검증 이력을 찾을 수 없습니다."));

        List<RestoreDetectedItemResponse> detectedItems = switch (history.getStatus()) {
            case VALIDATED -> recalculateDetectedItems(history);
            case FAILED, UPLOADED -> List.of();
        };

        return new RestoreDetailResponse(
                history.getId(),
                history.getStatus().name(),
                history.getFileName(),
                history.getUploadedAt(),
                history.getValidatedAt(),
                history.getUploadedByNameSnapshot(),
                history.getFormatVersion(),
                history.getDatasourceType(),
                history.getBackupId(),
                history.getFailureReason(),
                detectedItems
        );
    }

    @Transactional(noRollbackFor = Exception.class)
    public RestoreUploadResponse uploadAndValidate(MultipartFile file, SessionUser sessionUser) {
        User currentUser = accessPolicyService.getCurrentUser(sessionUser);
        if (!accessPolicyService.isAdmin(currentUser)) {
            throw new AppException(HttpStatus.FORBIDDEN, "RESTORE_UPLOAD_FORBIDDEN", "복원 ZIP 업로드 권한이 없습니다.");
        }

        validateMultipartFile(file);

        Path root = prepareRestoreRoot();
        String originalFileName = normalizeOriginalFileName(file.getOriginalFilename());
        Path storedFilePath = storeUploadedFile(file, root, originalFileName);

        RestoreHistory history = new RestoreHistory();
        history.setStatus(RestoreStatus.UPLOADED);
        history.setFileName(truncate(originalFileName, 255));
        history.setFilePath(storedFilePath.toString());
        history.setFileSizeBytes(file.getSize());
        history.setUploadedAt(SeoulDateTimeSupport.now());
        history.setUploadedById(currentUser.getId());
        history.setUploadedByNameSnapshot(currentUser.getName());
        restoreHistoryRepository.save(history);

        try {
            ValidationResult validationResult = inspectStoredZip(storedFilePath, originalFileName);
            history.setStatus(RestoreStatus.VALIDATED);
            history.setValidatedAt(SeoulDateTimeSupport.now());
            history.setFormatVersion(validationResult.formatVersion());
            history.setDatasourceType(validationResult.datasourceType());
            history.setBackupId(validationResult.backupId());
            history.setFailureReason(null);
            restoreHistoryRepository.save(history);

            activityLogService.log(
                    currentUser,
                    ActivityActionType.RESTORE_UPLOAD,
                    ActivityTargetType.RESTORE,
                    history.getId(),
                    history.getFileName(),
                    "복원 ZIP 업로드 및 검증 성공: " + history.getFileName()
            );

            return new RestoreUploadResponse(
                    history.getId(),
                    history.getStatus().name(),
                    history.getFileName(),
                    history.getValidatedAt(),
                    history.getFormatVersion(),
                    history.getDatasourceType(),
                    history.getBackupId(),
                    validationResult.detectedItems(),
                    null
            );
        } catch (Exception exception) {
            history.setStatus(RestoreStatus.FAILED);
            history.setValidatedAt(SeoulDateTimeSupport.now());
            history.setFailureReason(buildFailureReason(exception));
            restoreHistoryRepository.save(history);

            activityLogService.logBestEffort(
                    currentUser,
                    ActivityActionType.RESTORE_UPLOAD,
                    ActivityTargetType.RESTORE,
                    history.getId(),
                    history.getFileName(),
                    "복원 ZIP 업로드 및 검증 실패: " + history.getFileName() + " / " + history.getFailureReason()
            );

            if (exception instanceof AppException appException) {
                throw appException;
            }
            throw new AppException(HttpStatus.INTERNAL_SERVER_ERROR, "RESTORE_UPLOAD_FAILED", "복원 ZIP 업로드 처리에 실패했습니다.");
        }
    }

    private void validateMultipartFile(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new AppException(HttpStatus.BAD_REQUEST, "RESTORE_FILE_INVALID", "업로드할 ZIP 파일이 필요합니다.");
        }
        if (file.getSize() > maxUploadSizeBytes) {
            throw new AppException(HttpStatus.BAD_REQUEST, "RESTORE_FILE_INVALID", "업로드 가능한 ZIP 최대 크기는 500MB입니다.");
        }
    }

    private Path prepareRestoreRoot() {
        Path root = Path.of(restoreRootPath).toAbsolutePath().normalize();
        try {
            if (Files.exists(root) && !Files.isDirectory(root)) {
                throw new IOException("Restore path points to a file, not a directory.");
            }
            Files.createDirectories(root);
            Path probe = Files.createTempFile(root, "restore-preflight-", ".tmp");
            Files.deleteIfExists(probe);
            return root;
        } catch (IOException exception) {
            throw new AppException(HttpStatus.INTERNAL_SERVER_ERROR, "RESTORE_UPLOAD_FAILED",
                    "복원 업로드 경로를 사용할 수 없습니다: " + exception.getMessage());
        }
    }

    private Path storeUploadedFile(MultipartFile file, Path root, String originalFileName) {
        String safeOriginalName = sanitizeFileName(originalFileName);
        String storedFileName = "restore-" + FILE_FORMAT.format(SeoulDateTimeSupport.now()) + "-" + safeOriginalName;
        Path storedFilePath = root.resolve(storedFileName).normalize();
        try (InputStream inputStream = file.getInputStream()) {
            Files.copy(inputStream, storedFilePath);
            return storedFilePath;
        } catch (IOException exception) {
            throw new AppException(HttpStatus.INTERNAL_SERVER_ERROR, "RESTORE_UPLOAD_FAILED", "업로드 파일 저장에 실패했습니다.");
        }
    }

    private List<RestoreDetectedItemResponse> recalculateDetectedItems(RestoreHistory history) {
        if (!StringUtils.hasText(history.getFilePath())) {
            throw new AppException(HttpStatus.INTERNAL_SERVER_ERROR, "RESTORE_ARCHIVE_UNAVAILABLE", "저장된 복원 ZIP 파일을 사용할 수 없습니다.");
        }

        try {
            return inspectStoredZip(Path.of(history.getFilePath()), history.getFileName()).detectedItems();
        } catch (AppException exception) {
            throw mapRestoreDetailInspectionException(exception);
        } catch (RuntimeException exception) {
            throw new AppException(HttpStatus.INTERNAL_SERVER_ERROR, "RESTORE_ARCHIVE_UNAVAILABLE", "저장된 복원 ZIP 파일을 사용할 수 없습니다.");
        }
    }

    private ValidationResult inspectStoredZip(Path storedFilePath, String originalFileName) {
        if (!originalFileName.toLowerCase(Locale.ROOT).endsWith(".zip")) {
            throw new AppException(HttpStatus.BAD_REQUEST, "RESTORE_FILE_INVALID", ".zip 파일만 업로드할 수 있습니다.");
        }

        try (ZipFile zipFile = new ZipFile(storedFilePath.toFile(), StandardCharsets.UTF_8)) {
            Map<String, ZipEntry> actualEntries = indexZipEntries(zipFile);
            ZipEntry manifestEntry = actualEntries.get("manifest.json");
            if (manifestEntry == null) {
                throw new AppException(HttpStatus.BAD_REQUEST, "RESTORE_MANIFEST_INVALID", "manifest.json 파일이 없습니다.");
            }

            JsonNode manifestNode = readJson(zipFile, manifestEntry);
            ManifestData manifestData = parseManifest(manifestNode);
            validateRequiredStructure(manifestData.entries());
            validateManifestEntries(zipFile, actualEntries, manifestData.entries());
            validateDatabaseDumpConsistency(manifestData.summary(), manifestData.entries());

            return new ValidationResult(
                    manifestData.formatVersion(),
                    manifestData.datasourceType(),
                    manifestData.backupId(),
                    detectItems(manifestData.entries())
            );
        } catch (AppException exception) {
            throw exception;
        } catch (ZipException exception) {
            throw invalidZipException(exception);
        } catch (IOException exception) {
            throw new AppException(HttpStatus.BAD_REQUEST, "RESTORE_FILE_INVALID", "ZIP 파일을 열 수 없습니다.");
        }
    }

    private AppException mapRestoreDetailInspectionException(AppException exception) {
        if ("RESTORE_FILE_INVALID".equals(exception.getErrorCode())) {
            return new AppException(HttpStatus.INTERNAL_SERVER_ERROR, "RESTORE_ARCHIVE_UNAVAILABLE", "저장된 복원 ZIP 파일을 사용할 수 없습니다.");
        }
        return new AppException(HttpStatus.INTERNAL_SERVER_ERROR, "RESTORE_DETAIL_FAILED", "복원 검증 이력 상세 조회에 실패했습니다.");
    }

    private Map<String, ZipEntry> indexZipEntries(ZipFile zipFile) {
        Map<String, ZipEntry> entries = new LinkedHashMap<>();
        Enumeration<? extends ZipEntry> enumeration = zipFile.entries();
        while (enumeration.hasMoreElements()) {
            ZipEntry entry = enumeration.nextElement();
            if (entry.isDirectory()) {
                continue;
            }
            ZipEntry previous = entries.put(entry.getName(), entry);
            if (previous != null) {
                throw new AppException(HttpStatus.BAD_REQUEST, "RESTORE_MANIFEST_INVALID", "ZIP 내부에 중복 엔트리가 있습니다: " + entry.getName());
            }
        }
        return entries;
    }

    private JsonNode readJson(ZipFile zipFile, ZipEntry zipEntry) {
        try (InputStream inputStream = zipFile.getInputStream(zipEntry)) {
            return objectMapper.readTree(inputStream);
        } catch (ZipException exception) {
            throw invalidZipException(exception);
        } catch (IOException exception) {
            throw new AppException(HttpStatus.BAD_REQUEST, "RESTORE_MANIFEST_INVALID", "manifest.json 내용을 해석할 수 없습니다.");
        }
    }

    private ManifestData parseManifest(JsonNode manifestNode) {
        String formatVersion = requireText(manifestNode, "formatVersion");
        requireOffsetDateTime(manifestNode, "createdAt");
        String datasourceType = requireText(manifestNode, "datasourceType");
        requireText(manifestNode, "appVersion");
        long backupId = requireLong(manifestNode, "backupId");
        if (backupId <= 0) {
            throw new AppException(HttpStatus.BAD_REQUEST, "RESTORE_MANIFEST_INVALID", "manifest 필드가 올바르지 않습니다: backupId");
        }
        JsonNode executedByNode = requireObject(manifestNode, "executedBy");
        requireText(executedByNode, "loginId");
        requireText(executedByNode, "name");
        requireText(manifestNode, "profile");
        requireText(manifestNode, "environment");
        ManifestSummaryData summary = parseManifestSummary(requireObject(manifestNode, "summary"), datasourceType);
        JsonNode entriesNode = requireArray(manifestNode, "entries");

        if (!FORMAT_VERSION.equals(formatVersion)) {
            throw new AppException(HttpStatus.BAD_REQUEST, "RESTORE_MANIFEST_INVALID", "지원하지 않는 백업 포맷 버전입니다.");
        }
        if (entriesNode.size() == 0) {
            throw new AppException(HttpStatus.BAD_REQUEST, "RESTORE_MANIFEST_INVALID", "manifest entries 가 비어 있습니다.");
        }

        List<ManifestEntryData> entries = new ArrayList<>();
        Set<String> relativePaths = new HashSet<>();
        for (JsonNode entryNode : entriesNode) {
            String itemType = requireText(entryNode, "itemType");
            String relativePath = requireText(entryNode, "relativePath");
            long size = requireLong(entryNode, "size");
            String sha256 = requireText(entryNode, "sha256");

            if (size < 0) {
                throw new AppException(HttpStatus.BAD_REQUEST, "RESTORE_MANIFEST_INVALID", "manifest entry size 값이 올바르지 않습니다: " + relativePath);
            }
            if (!sha256.matches("(?i)[0-9a-f]{64}")) {
                throw new AppException(HttpStatus.BAD_REQUEST, "RESTORE_MANIFEST_INVALID", "manifest entry sha256 값이 올바르지 않습니다: " + relativePath);
            }
            if (!relativePaths.add(relativePath)) {
                throw new AppException(HttpStatus.BAD_REQUEST, "RESTORE_MANIFEST_INVALID", "manifest entry relativePath 가 중복되었습니다: " + relativePath);
            }
            entries.add(new ManifestEntryData(itemType, relativePath, size, sha256.toLowerCase(Locale.ROOT)));
        }
        return new ManifestData(formatVersion, datasourceType, backupId, summary, entries);
    }

    private ManifestSummaryData parseManifestSummary(JsonNode summaryNode, String datasourceType) {
        requireText(summaryNode, "backupType");
        requireText(summaryNode, "backupMethod");
        String summaryDatasourceType = requireText(summaryNode, "datasourceType");
        boolean includesDatabaseDump = requireBoolean(summaryNode, "includesDatabaseDump");
        requireLong(summaryNode, "userCount");
        requireLong(summaryNode, "clientCount");
        requireLong(summaryNode, "sessionCount");

        if (!datasourceType.equals(summaryDatasourceType)) {
            throw new AppException(HttpStatus.BAD_REQUEST, "RESTORE_MANIFEST_INVALID",
                    "manifest summary.datasourceType 가 상위 datasourceType 과 일치하지 않습니다.");
        }
        return new ManifestSummaryData(includesDatabaseDump);
    }

    private void validateRequiredStructure(List<ManifestEntryData> entries) {
        Set<String> declaredPaths = entries.stream()
                .map(ManifestEntryData::relativePath)
                .collect(java.util.stream.Collectors.toSet());

        for (String requiredPath : List.of("config/application.yml", "config/application-prod.yml", "metadata/summary.json")) {
            if (!declaredPaths.contains(requiredPath)) {
                throw new AppException(HttpStatus.BAD_REQUEST, "RESTORE_MANIFEST_INVALID", "표준 ZIP 필수 엔트리가 없습니다: " + requiredPath);
            }
        }
        if (declaredPaths.stream().noneMatch(path -> path.startsWith("scales/"))) {
            throw new AppException(HttpStatus.BAD_REQUEST, "RESTORE_MANIFEST_INVALID", "표준 ZIP 에 scales 엔트리가 없습니다.");
        }
    }

    private void validateManifestEntries(
            ZipFile zipFile,
            Map<String, ZipEntry> actualEntries,
            List<ManifestEntryData> manifestEntries
    ) {
        for (ManifestEntryData manifestEntry : manifestEntries) {
            ZipEntry actualEntry = actualEntries.get(manifestEntry.relativePath());
            if (actualEntry == null) {
                throw new AppException(HttpStatus.BAD_REQUEST, "RESTORE_MANIFEST_INVALID",
                        "manifest entry 와 실제 ZIP 엔트리가 일치하지 않습니다: " + manifestEntry.relativePath());
            }
            EntryContentData actualContent = readEntryContentData(zipFile, actualEntry);
            if (actualContent.size() != manifestEntry.size()) {
                throw new AppException(HttpStatus.BAD_REQUEST, "RESTORE_MANIFEST_INVALID",
                        "manifest entry size 가 실제 ZIP 과 일치하지 않습니다: " + manifestEntry.relativePath());
            }
            if (!actualContent.sha256().equalsIgnoreCase(manifestEntry.sha256())) {
                throw new AppException(HttpStatus.BAD_REQUEST, "RESTORE_MANIFEST_INVALID",
                        "manifest entry sha256 이 실제 ZIP 과 일치하지 않습니다: " + manifestEntry.relativePath());
            }
        }
    }

    private void validateDatabaseDumpConsistency(ManifestSummaryData summary, List<ManifestEntryData> entries) {
        boolean hasDatabaseDumpEntry = entries.stream()
                .anyMatch(entry -> "db/database.sql".equals(entry.relativePath()));
        if (summary.includesDatabaseDump() != hasDatabaseDumpEntry) {
            throw new AppException(HttpStatus.BAD_REQUEST, "RESTORE_MANIFEST_INVALID",
                    "manifest summary.includesDatabaseDump 와 db/database.sql 포함 여부가 일치하지 않습니다.");
        }
    }

    private EntryContentData readEntryContentData(ZipFile zipFile, ZipEntry zipEntry) {
        try (InputStream inputStream = zipFile.getInputStream(zipEntry)) {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            long size = 0;
            byte[] buffer = new byte[8192];
            int read;
            while ((read = inputStream.read(buffer)) >= 0) {
                if (read == 0) {
                    continue;
                }
                digest.update(buffer, 0, read);
                size += read;
            }
            return new EntryContentData(size, HexFormat.of().formatHex(digest.digest()));
        } catch (ZipException exception) {
            throw invalidZipException(exception);
        } catch (IOException exception) {
            throw new AppException(HttpStatus.BAD_REQUEST, "RESTORE_FILE_INVALID", "ZIP 엔트리를 읽을 수 없습니다: " + zipEntry.getName());
        } catch (NoSuchAlgorithmException exception) {
            throw new AppException(HttpStatus.INTERNAL_SERVER_ERROR, "RESTORE_UPLOAD_FAILED", "SHA-256 계산을 사용할 수 없습니다.");
        }
    }

    private List<RestoreDetectedItemResponse> detectItems(List<ManifestEntryData> entries) {
        List<RestoreDetectedItemResponse> detectedItems = new ArrayList<>();

        List<String> databasePaths = filterPaths(entries, path -> "db/database.sql".equals(path));
        if (!databasePaths.isEmpty()) {
            detectedItems.add(new RestoreDetectedItemResponse("DATABASE", databasePaths));
        }

        List<String> configPaths = filterPaths(entries, path -> path.startsWith("config/"));
        if (!configPaths.isEmpty()) {
            detectedItems.add(new RestoreDetectedItemResponse("CONFIG", configPaths));
        }

        List<String> scalePaths = filterPaths(entries, path -> path.startsWith("scales/"));
        if (!scalePaths.isEmpty()) {
            detectedItems.add(new RestoreDetectedItemResponse("SCALES", scalePaths));
        }

        List<String> metadataPaths = filterPaths(entries, path -> path.startsWith("metadata/"));
        if (!metadataPaths.isEmpty()) {
            detectedItems.add(new RestoreDetectedItemResponse("METADATA", metadataPaths));
        }

        return detectedItems;
    }

    private List<String> filterPaths(List<ManifestEntryData> entries, java.util.function.Predicate<String> predicate) {
        return entries.stream()
                .map(ManifestEntryData::relativePath)
                .filter(predicate)
                .sorted()
                .toList();
    }

    private String requireText(JsonNode node, String fieldName) {
        JsonNode valueNode = node.get(fieldName);
        if (valueNode == null || !valueNode.isTextual() || !StringUtils.hasText(valueNode.asText())) {
            throw new AppException(HttpStatus.BAD_REQUEST, "RESTORE_MANIFEST_INVALID", "manifest 필드가 올바르지 않습니다: " + fieldName);
        }
        return valueNode.asText().trim();
    }

    private long requireLong(JsonNode node, String fieldName) {
        JsonNode valueNode = node.get(fieldName);
        if (valueNode == null || !valueNode.canConvertToLong()) {
            throw new AppException(HttpStatus.BAD_REQUEST, "RESTORE_MANIFEST_INVALID", "manifest 필드가 올바르지 않습니다: " + fieldName);
        }
        return valueNode.asLong();
    }

    private boolean requireBoolean(JsonNode node, String fieldName) {
        JsonNode valueNode = node.get(fieldName);
        if (valueNode == null || !valueNode.isBoolean()) {
            throw new AppException(HttpStatus.BAD_REQUEST, "RESTORE_MANIFEST_INVALID", "manifest 필드가 올바르지 않습니다: " + fieldName);
        }
        return valueNode.asBoolean();
    }

    private OffsetDateTime requireOffsetDateTime(JsonNode node, String fieldName) {
        String value = requireText(node, fieldName);
        try {
            return OffsetDateTime.parse(value);
        } catch (Exception exception) {
            throw new AppException(HttpStatus.BAD_REQUEST, "RESTORE_MANIFEST_INVALID", "manifest 필드가 올바르지 않습니다: " + fieldName);
        }
    }

    private JsonNode requireObject(JsonNode node, String fieldName) {
        JsonNode valueNode = node.get(fieldName);
        if (valueNode == null || !valueNode.isObject()) {
            throw new AppException(HttpStatus.BAD_REQUEST, "RESTORE_MANIFEST_INVALID", "manifest 필드가 올바르지 않습니다: " + fieldName);
        }
        return valueNode;
    }

    private JsonNode requireArray(JsonNode node, String fieldName) {
        JsonNode valueNode = node.get(fieldName);
        if (valueNode == null || !valueNode.isArray()) {
            throw new AppException(HttpStatus.BAD_REQUEST, "RESTORE_MANIFEST_INVALID", "manifest 필드가 올바르지 않습니다: " + fieldName);
        }
        return valueNode;
    }

    private AppException invalidZipException(ZipException exception) {
        String message = exception.getMessage() == null ? "" : exception.getMessage().toLowerCase(Locale.ROOT);
        if (message.contains("encrypted")) {
            return new AppException(HttpStatus.BAD_REQUEST, "RESTORE_FILE_INVALID", "암호화 ZIP은 지원하지 않습니다.");
        }
        return new AppException(HttpStatus.BAD_REQUEST, "RESTORE_FILE_INVALID", "유효한 ZIP 파일이 아닙니다.");
    }

    private String normalizeOriginalFileName(String originalFileName) {
        String cleaned = StringUtils.hasText(originalFileName) ? originalFileName.trim() : "uploaded-file";
        return truncate(cleaned.replace('\\', '/').substring(cleaned.replace('\\', '/').lastIndexOf('/') + 1), 255);
    }

    private String sanitizeFileName(String fileName) {
        String sanitized = fileName.replaceAll("[^A-Za-z0-9._-]", "_");
        if (!StringUtils.hasText(sanitized)) {
            sanitized = "uploaded-file.zip";
        }
        return truncate(sanitized, 120);
    }

    private String truncate(String value, int maxLength) {
        return value.length() <= maxLength ? value : value.substring(0, maxLength);
    }

    private String buildFailureReason(Exception exception) {
        String message = exception.getMessage();
        String detailed = exception.getClass().getSimpleName() + (message == null || message.isBlank() ? "" : ": " + message);
        return truncate(detailed, 500);
    }

    private record ValidationResult(
            String formatVersion,
            String datasourceType,
            Long backupId,
            List<RestoreDetectedItemResponse> detectedItems
    ) {
    }

    private record ManifestData(
            String formatVersion,
            String datasourceType,
            Long backupId,
            ManifestSummaryData summary,
            List<ManifestEntryData> entries
    ) {
    }

    private record ManifestSummaryData(boolean includesDatabaseDump) {
    }

    private record ManifestEntryData(
            String itemType,
            String relativePath,
            long size,
            String sha256
    ) {
    }

    private record EntryContentData(long size, String sha256) {
    }
}
