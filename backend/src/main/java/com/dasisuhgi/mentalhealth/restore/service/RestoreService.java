package com.dasisuhgi.mentalhealth.restore.service;

import com.dasisuhgi.mentalhealth.audit.entity.ActivityActionType;
import com.dasisuhgi.mentalhealth.audit.entity.ActivityTargetType;
import com.dasisuhgi.mentalhealth.audit.service.ActivityLogService;
import com.dasisuhgi.mentalhealth.backup.dto.ManualBackupRunResponse;
import com.dasisuhgi.mentalhealth.backup.service.BackupService;
import com.dasisuhgi.mentalhealth.common.api.PageResponse;
import com.dasisuhgi.mentalhealth.common.error.AppException;
import com.dasisuhgi.mentalhealth.common.security.AccessPolicyService;
import com.dasisuhgi.mentalhealth.common.session.SessionUser;
import com.dasisuhgi.mentalhealth.common.time.SeoulDateTimeSupport;
import com.dasisuhgi.mentalhealth.restore.dto.RestoreDetectedItemResponse;
import com.dasisuhgi.mentalhealth.restore.dto.RestoreDetailResponse;
import com.dasisuhgi.mentalhealth.restore.dto.RestoreExecuteRequest;
import com.dasisuhgi.mentalhealth.restore.dto.RestoreExecuteResponse;
import com.dasisuhgi.mentalhealth.restore.dto.RestoreHistoryListItemResponse;
import com.dasisuhgi.mentalhealth.restore.dto.RestorePreparationGroupResponse;
import com.dasisuhgi.mentalhealth.restore.dto.RestorePreparationResponse;
import com.dasisuhgi.mentalhealth.restore.dto.RestoreUploadResponse;
import com.dasisuhgi.mentalhealth.restore.entity.RestoreHistory;
import com.dasisuhgi.mentalhealth.restore.entity.RestoreStatus;
import com.dasisuhgi.mentalhealth.restore.repository.RestoreHistoryQueryRepository;
import com.dasisuhgi.mentalhealth.restore.repository.RestoreHistoryRepository;
import com.dasisuhgi.mentalhealth.user.entity.User;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.IOException;
import java.io.InputStream;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Enumeration;
import java.util.HashSet;
import java.util.HexFormat;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.TimeUnit;
import java.util.zip.ZipEntry;
import java.util.zip.ZipException;
import java.util.zip.ZipFile;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.util.StringUtils;
import org.springframework.web.multipart.MultipartFile;

@Service
public class RestoreService {
    private static final String FORMAT_VERSION = "FULL_BACKUP_ZIP_V1";
    private static final String DATABASE_ITEM_TYPE = "DATABASE";
    private static final String DATABASE_SQL_PATH = "db/database.sql";
    private static final String EXECUTE_CONFIRMATION_TEXT = "전체 복원을 실행합니다";
    private static final String EXECUTION_CAPABILITY_EXECUTABLE = "EXECUTABLE";
    private static final String EXECUTION_CAPABILITY_BLOCKED = "BLOCKED";
    private static final String EXECUTION_CAPABILITY_UNAVAILABLE_REASON = "ZIP 구조 검증이 완료되지 않아 현재 버전 실행 가능 여부를 확인할 수 없습니다.";
    private static final String EXECUTION_CAPABILITY_RECHECK_UNAVAILABLE_REASON = "저장된 복원 ZIP 파일을 다시 확인할 수 없어 현재 버전 실행 가능 여부를 확인할 수 없습니다.";
    private static final String CONFIRMATION_STATUS_NOT_APPLICABLE = "NOT_APPLICABLE";
    private static final String CONFIRMATION_STATUS_WAITING_INPUT = "WAITING_INPUT";
    private static final String CONFIRMATION_STATUS_MATCHED = "MATCHED";
    private static final String CONFIRMATION_STATUS_MISMATCHED = "MISMATCHED";
    private static final Set<String> EXECUTABLE_ITEM_TYPES = Set.of(DATABASE_ITEM_TYPE);
    private static final long MAX_UPLOAD_SIZE_BYTES = 500L * 1024L * 1024L;
    private static final long DEFAULT_IMPORT_TIMEOUT_SECONDS = 60L;
    private static final DateTimeFormatter FILE_FORMAT = DateTimeFormatter.ofPattern("yyyyMMdd-HHmmss");

    private final RestoreHistoryRepository restoreHistoryRepository;
    private final RestoreHistoryQueryRepository restoreHistoryQueryRepository;
    private final AccessPolicyService accessPolicyService;
    private final ActivityLogService activityLogService;
    private final BackupService backupService;
    private final ObjectMapper objectMapper;
    private final JdbcTemplate jdbcTemplate;
    private final String restoreRootPath;
    private final long maxUploadSizeBytes;
    private final String datasourceUrl;
    private final String datasourceUsername;
    private final String datasourcePassword;
    private final String dbImportCommand;
    private final long dbImportTimeoutSeconds;
    private final TransactionTemplate writeTransactionTemplate;

    public RestoreService(
            RestoreHistoryRepository restoreHistoryRepository,
            RestoreHistoryQueryRepository restoreHistoryQueryRepository,
            AccessPolicyService accessPolicyService,
            ActivityLogService activityLogService,
            BackupService backupService,
            ObjectMapper objectMapper,
            JdbcTemplate jdbcTemplate,
            PlatformTransactionManager transactionManager,
            @Value("${app.restore.root-path:./tmp/restores}") String restoreRootPath,
            @Value("${app.restore.max-upload-size-bytes:524288000}") long maxUploadSizeBytes,
            @Value("${spring.datasource.url}") String datasourceUrl,
            @Value("${spring.datasource.username:}") String datasourceUsername,
            @Value("${spring.datasource.password:}") String datasourcePassword,
            @Value("${app.restore.db-import-command:}") String dbImportCommand,
            @Value("${app.restore.db-import-timeout-seconds:60}") long dbImportTimeoutSeconds
    ) {
        this.restoreHistoryRepository = restoreHistoryRepository;
        this.restoreHistoryQueryRepository = restoreHistoryQueryRepository;
        this.accessPolicyService = accessPolicyService;
        this.activityLogService = activityLogService;
        this.backupService = backupService;
        this.objectMapper = objectMapper;
        this.jdbcTemplate = jdbcTemplate;
        this.restoreRootPath = restoreRootPath;
        this.maxUploadSizeBytes = maxUploadSizeBytes > 0 ? maxUploadSizeBytes : MAX_UPLOAD_SIZE_BYTES;
        this.datasourceUrl = datasourceUrl;
        this.datasourceUsername = datasourceUsername;
        this.datasourcePassword = datasourcePassword;
        this.dbImportCommand = dbImportCommand;
        this.dbImportTimeoutSeconds = dbImportTimeoutSeconds > 0 ? dbImportTimeoutSeconds : DEFAULT_IMPORT_TIMEOUT_SECONDS;
        this.writeTransactionTemplate = new TransactionTemplate(transactionManager);
        this.writeTransactionTemplate.setPropagationBehavior(TransactionDefinition.PROPAGATION_REQUIRES_NEW);
    }

    @Transactional(readOnly = true)
    public PageResponse<RestoreHistoryListItemResponse> getRestoreHistories(
            String status,
            LocalDate dateFrom,
            LocalDate dateTo,
            int page,
            int size,
            SessionUser sessionUser
    ) {
        if (page < 1 || size < 1) {
            throw new AppException(HttpStatus.BAD_REQUEST, "INVALID_PAGE_REQUEST", "페이지 요청 값을 다시 확인해주세요.");
        }
        if (dateFrom != null && dateTo != null && dateFrom.isAfter(dateTo)) {
            throw new AppException(HttpStatus.BAD_REQUEST, "INVALID_DATE_RANGE", "조회 기간을 다시 확인해주세요.");
        }

        User currentUser = accessPolicyService.getCurrentUser(sessionUser);
        accessPolicyService.assertAdmin(currentUser);
        PageResponse<RestoreHistory> historyPage = restoreHistoryQueryRepository.findRestoreHistories(
                parseRestoreStatus(status),
                dateFrom,
                dateTo,
                page,
                size
        );
        List<RestoreHistoryListItemResponse> items = historyPage.items().stream()
                .map(this::buildRestoreHistoryListItemResponse)
                .toList();
        return new PageResponse<>(items, historyPage.page(), historyPage.size(), historyPage.totalItems(), historyPage.totalPages());
    }

    @Transactional(readOnly = true)
    public RestoreDetailResponse getRestoreDetail(Long restoreId, SessionUser sessionUser) {
        User currentUser = accessPolicyService.getCurrentUser(sessionUser);
        if (!accessPolicyService.isAdmin(currentUser)) {
            throw new AppException(HttpStatus.FORBIDDEN, "RESTORE_DETAIL_FORBIDDEN", "복원 검증 이력을 조회할 권한이 없습니다.");
        }

        RestoreHistory history = restoreHistoryRepository.findById(restoreId)
                .orElseThrow(() -> new AppException(HttpStatus.NOT_FOUND, "RESTORE_HISTORY_NOT_FOUND", "복원 검증 이력을 찾을 수 없습니다."));

        ValidationResult validationResult = canInspectArchive(history) ? resolveDetailValidationResult(history) : null;
        List<RestoreDetectedItemResponse> detectedItems = validationResult == null ? List.of() : validationResult.detectedItems();
        ExecutionCapabilityResult executionCapability = resolveExecutionCapability(history, validationResult);

        return new RestoreDetailResponse(
                history.getId(),
                history.getStatus().name(),
                history.getFileName(),
                history.getUploadedAt(),
                history.getValidatedAt(),
                history.getExecutedAt(),
                history.getUploadedByNameSnapshot(),
                history.getFormatVersion(),
                history.getDatasourceType(),
                history.getBackupId(),
                parseSelectedItemTypes(history.getSelectedItemTypes()),
                history.getPreBackupId(),
                history.getPreBackupFileName(),
                history.getFailureReason(),
                detectedItems,
                executionCapability.executionCapability(),
                executionCapability.executionBlockedReason()
        );
    }

    @Transactional(readOnly = true)
    public RestorePreparationResponse getRestorePreparation(Long restoreId, RestoreExecuteRequest request, SessionUser sessionUser) {
        User currentUser = accessPolicyService.getCurrentUser(sessionUser);
        if (!accessPolicyService.isAdmin(currentUser)) {
            throw new AppException(HttpStatus.FORBIDDEN, "RESTORE_PREPARATION_FORBIDDEN", "복원 실행 준비 상태를 조회할 권한이 없습니다.");
        }

        RestoreHistory history = restoreHistoryRepository.findById(restoreId)
                .orElseThrow(() -> new AppException(HttpStatus.NOT_FOUND, "RESTORE_HISTORY_NOT_FOUND", "복원 검증 이력을 찾을 수 없습니다."));

        ValidationResult validationResult = canInspectArchive(history) ? resolveDetailValidationResult(history) : null;
        return buildPreparationResponse(history, validationResult, request);
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
            ExecutionCapabilityResult executionCapability = resolveExecutionCapability(validationResult);

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
                    null,
                    executionCapability.executionCapability(),
                    executionCapability.executionBlockedReason()
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

    public RestoreExecuteResponse executeRestore(Long restoreId, RestoreExecuteRequest request, SessionUser sessionUser) {
        User currentUser = accessPolicyService.getCurrentUser(sessionUser);
        if (!accessPolicyService.isAdmin(currentUser)) {
            throw new AppException(HttpStatus.FORBIDDEN, "RESTORE_EXECUTE_FORBIDDEN", "복원 실행 권한이 없습니다.");
        }

        RestoreExecutionContext executionContext = prepareRestoreExecution(restoreId, request);
        RestoreHistory history = executionContext.history();
        List<String> selectedItemTypes = executionContext.selectedItemTypes();

        activityLogService.logBestEffort(
                currentUser,
                ActivityActionType.RESTORE_EXECUTE,
                ActivityTargetType.RESTORE,
                history.getId(),
                history.getFileName(),
                "복원 실행 시작: restoreId=" + history.getId() + ", selectedItemTypes=" + String.join(",", selectedItemTypes)
        );

        ManualBackupRunResponse preBackupResult;
        try {
            preBackupResult = backupService.runPreRestoreBackup(
                    "restoreId=" + history.getId() + " pre-restore backup",
                    currentUser
            );
        } catch (Exception exception) {
            String failureReason = buildFailureReason(exception);
            history.setStatus(RestoreStatus.PRE_BACKUP_FAILED);
            history.setFailureReason(failureReason);
            history = saveRestoreHistory(history);

            activityLogService.logBestEffort(
                    currentUser,
                    ActivityActionType.RESTORE_EXECUTE,
                    ActivityTargetType.RESTORE,
                    history.getId(),
                    history.getFileName(),
                    "복원 실행 실패(pre-backup): restoreId=" + history.getId() + ", reason=" + failureReason
            );

            return buildExecuteResponse(history, "복원 직전 자동 백업에 실패했습니다.");
        }

        history.setPreBackupId(preBackupResult.backupId());
        history.setPreBackupFileName(preBackupResult.fileName());
        history.setStatus(RestoreStatus.RESTORING);
        history = saveRestoreHistory(history);

        try {
            executeDatabaseRestore(Path.of(history.getFilePath()), executionContext.archiveDatasourceType());
            history.setStatus(RestoreStatus.SUCCESS);
            history.setFailureReason(null);
            history = saveRestoreHistory(history);

            activityLogService.logBestEffort(
                    currentUser,
                    ActivityActionType.RESTORE_EXECUTE,
                    ActivityTargetType.RESTORE,
                    history.getId(),
                    history.getFileName(),
                    "복원 실행 성공: restoreId=" + history.getId()
                            + ", preBackupId=" + history.getPreBackupId()
                            + ", selectedItemTypes=" + String.join(",", selectedItemTypes)
            );

            return buildExecuteResponse(history, "복원 실행이 완료되었습니다.");
        } catch (Exception exception) {
            String failureReason = buildFailureReason(exception);
            history.setStatus(RestoreStatus.FAILED);
            history.setFailureReason(failureReason);
            history = saveRestoreHistory(history);

            activityLogService.logBestEffort(
                    currentUser,
                    ActivityActionType.RESTORE_EXECUTE,
                    ActivityTargetType.RESTORE,
                    history.getId(),
                    history.getFileName(),
                    "복원 실행 실패: restoreId=" + history.getId() + ", reason=" + failureReason
            );

            return buildExecuteResponse(history, "DATABASE 복원 실행에 실패했습니다.");
        }
    }

    private RestoreExecutionContext prepareRestoreExecution(Long restoreId, RestoreExecuteRequest request) {
        return executeInWriteTransaction(() -> {
            RestoreHistory history = restoreHistoryRepository.findLockedById(restoreId)
                    .orElseThrow(() -> new AppException(HttpStatus.NOT_FOUND, "RESTORE_HISTORY_NOT_FOUND", "복원 검증 이력을 찾을 수 없습니다."));

            if (history.getStatus() != RestoreStatus.VALIDATED) {
                throw new AppException(HttpStatus.CONFLICT, "RESTORE_EXECUTE_INVALID_STATUS", "VALIDATED 상태의 복원 검증 이력만 실행할 수 있습니다.");
            }

            ValidationResult validationResult = resolveStoredValidationResult(history);
            List<String> selectedItemTypes = normalizeSelectedItemTypes(request == null ? null : request.selectedItemTypes());
            assertExecutableSelection(selectedItemTypes, validationResult.detectedItems());
            assertConfirmationText(request == null ? null : request.confirmationText());

            String archiveDatasourceType = normalizeDatasourceType(validationResult.datasourceType());
            String runtimeDatasourceType = determineDatasourceType(datasourceUrl);
            if (!isSupportedImportDatasource(archiveDatasourceType) || !isSupportedImportDatasource(runtimeDatasourceType)) {
                throw new AppException(HttpStatus.BAD_REQUEST, "RESTORE_UNSUPPORTED_DATASOURCE",
                        "현재 버전에서는 MariaDB/MySQL datasource 의 DATABASE 복원만 지원합니다.");
            }

            history.setExecutedAt(SeoulDateTimeSupport.now());
            history.setSelectedItemTypes(String.join(",", selectedItemTypes));
            history.setPreBackupId(null);
            history.setPreBackupFileName(null);
            history.setFailureReason(null);
            history.setStatus(RestoreStatus.PRE_BACKUP_RUNNING);
            RestoreHistory savedHistory = restoreHistoryRepository.saveAndFlush(history);

            return new RestoreExecutionContext(savedHistory, archiveDatasourceType, selectedItemTypes);
        });
    }

    private RestoreHistory saveRestoreHistory(RestoreHistory history) {
        return executeInWriteTransaction(() -> {
            if (history.getId() != null && restoreHistoryRepository.existsById(history.getId())) {
                return restoreHistoryRepository.saveAndFlush(history);
            }
            insertRestoreHistory(history);
            return history;
        });
    }

    private <T> T executeInWriteTransaction(java.util.function.Supplier<T> action) {
        T result = writeTransactionTemplate.execute(status -> action.get());
        if (result == null) {
            throw new IllegalStateException("Transaction callback returned null.");
        }
        return result;
    }

    private void insertRestoreHistory(RestoreHistory history) {
        jdbcTemplate.update("""
                        INSERT INTO restore_histories (
                            id,
                            status,
                            file_name,
                            file_path,
                            file_size_bytes,
                            uploaded_at,
                            validated_at,
                            uploaded_by_id,
                            uploaded_by_name_snapshot,
                            format_version,
                            datasource_type,
                            backup_id,
                            executed_at,
                            selected_item_types,
                            pre_backup_id,
                            pre_backup_file_name,
                            failure_reason,
                            created_at
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                        """,
                history.getId(),
                history.getStatus().name(),
                history.getFileName(),
                history.getFilePath(),
                history.getFileSizeBytes(),
                history.getUploadedAt(),
                history.getValidatedAt(),
                history.getUploadedById(),
                history.getUploadedByNameSnapshot(),
                history.getFormatVersion(),
                history.getDatasourceType(),
                history.getBackupId(),
                history.getExecutedAt(),
                history.getSelectedItemTypes(),
                history.getPreBackupId(),
                history.getPreBackupFileName(),
                history.getFailureReason(),
                history.getCreatedAt()
        );
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

    private boolean canInspectArchive(RestoreHistory history) {
        return StringUtils.hasText(history.getFilePath()) && StringUtils.hasText(history.getFormatVersion());
    }

    private ValidationResult resolveDetailValidationResult(RestoreHistory history) {
        if (!StringUtils.hasText(history.getFilePath())) {
            throw new AppException(HttpStatus.INTERNAL_SERVER_ERROR, "RESTORE_ARCHIVE_UNAVAILABLE", "저장된 복원 ZIP 파일을 사용할 수 없습니다.");
        }

        try {
            return inspectStoredZip(Path.of(history.getFilePath()), history.getFileName());
        } catch (AppException exception) {
            throw mapRestoreDetailInspectionException(exception);
        } catch (RuntimeException exception) {
            throw new AppException(HttpStatus.INTERNAL_SERVER_ERROR, "RESTORE_ARCHIVE_UNAVAILABLE", "저장된 복원 ZIP 파일을 사용할 수 없습니다.");
        }
    }

    private ValidationResult resolveStoredValidationResult(RestoreHistory history) {
        if (!StringUtils.hasText(history.getFilePath())) {
            throw new AppException(HttpStatus.CONFLICT, "RESTORE_ARCHIVE_UNAVAILABLE", "저장된 복원 ZIP 파일을 사용할 수 없습니다.");
        }

        try {
            Path archivePath = Path.of(history.getFilePath());
            if (!Files.isRegularFile(archivePath) || !Files.isReadable(archivePath)) {
                throw new IOException("stored archive is not accessible");
            }
            return inspectStoredZip(archivePath, history.getFileName());
        } catch (AppException exception) {
            throw new AppException(HttpStatus.CONFLICT, "RESTORE_ARCHIVE_UNAVAILABLE", "저장된 복원 ZIP 파일을 사용할 수 없습니다.");
        } catch (Exception exception) {
            throw new AppException(HttpStatus.CONFLICT, "RESTORE_ARCHIVE_UNAVAILABLE", "저장된 복원 ZIP 파일을 사용할 수 없습니다.");
        }
    }

    private RestorePreparationResponse buildPreparationResponse(
            RestoreHistory history,
            ValidationResult validationResult,
            RestoreExecuteRequest request
    ) {
        List<String> requestedSelections = normalizeSelectedItemTypes(request == null ? null : request.selectedItemTypes());
        List<String> supportedSelections = requestedSelections.stream()
                .filter(EXECUTABLE_ITEM_TYPES::contains)
                .toList();
        List<String> unsupportedSelections = requestedSelections.stream()
                .filter(itemType -> !EXECUTABLE_ITEM_TYPES.contains(itemType))
                .toList();
        String confirmationText = request == null ? null : request.confirmationText();

        String archiveDatasourceType = normalizeDatasourceType(validationResult == null ? history.getDatasourceType() : validationResult.datasourceType());
        boolean statusAllowsExecution = history.getStatus() == RestoreStatus.VALIDATED;
        List<String> databasePaths = findDetectedItemPaths(validationResult == null ? List.of() : validationResult.detectedItems(), DATABASE_ITEM_TYPE);
        ExecutionCapabilityResult executionCapability = evaluateExecutionCapability(archiveDatasourceType, databasePaths);
        boolean hasDatabaseGroup = !databasePaths.isEmpty();
        boolean databaseSelected = hasDatabaseGroup && supportedSelections.contains(DATABASE_ITEM_TYPE);
        int selectedGroupCount = databaseSelected ? 1 : 0;

        List<String> groupBlockedReasons = new ArrayList<>();
        if (!statusAllowsExecution) {
            groupBlockedReasons.add("VALIDATED 상태의 복원 검증 상세에서만 DATABASE 복원 실행을 진행할 수 있습니다.");
        }
        groupBlockedReasons.addAll(executionCapability.blockedReasons());

        List<RestorePreparationGroupResponse> itemGroups = validationResult == null
                ? List.of()
                : List.of(new RestorePreparationGroupResponse(
                        DATABASE_ITEM_TYPE,
                        databasePaths,
                        groupBlockedReasons.isEmpty(),
                        databaseSelected,
                        joinReasons(groupBlockedReasons)
                ));

        String confirmationTextStatus = determineConfirmationTextStatus(groupBlockedReasons, confirmationText);
        boolean confirmationTextMatched = CONFIRMATION_STATUS_MATCHED.equals(confirmationTextStatus);
        List<String> blockedReasons = new ArrayList<>(groupBlockedReasons);
        if (blockedReasons.isEmpty() && !unsupportedSelections.isEmpty()) {
            blockedReasons.add("현재 버전에서는 DATABASE 그룹만 실제 복원할 수 있습니다.");
        }
        if (blockedReasons.isEmpty() && !supportedSelections.isEmpty() && !hasDatabaseGroup) {
            blockedReasons.add("선택한 복원 대상이 저장된 ZIP 에 존재하지 않습니다.");
        }
        if (blockedReasons.isEmpty() && selectedGroupCount == 0) {
            blockedReasons.add("복원 대상 항목을 하나 이상 선택해주세요.");
        }
        if (blockedReasons.isEmpty() && CONFIRMATION_STATUS_WAITING_INPUT.equals(confirmationTextStatus)) {
            blockedReasons.add("확인 문구를 입력해주세요.");
        }
        if (blockedReasons.isEmpty() && CONFIRMATION_STATUS_MISMATCHED.equals(confirmationTextStatus)) {
            blockedReasons.add("확인 문구는 정확히 " + EXECUTE_CONFIRMATION_TEXT + " 이어야 합니다.");
        }

        return new RestorePreparationResponse(
                history.getId(),
                history.getStatus().name(),
                EXECUTE_CONFIRMATION_TEXT,
                confirmationTextStatus,
                itemGroups,
                databaseSelected ? List.of(DATABASE_ITEM_TYPE) : List.of(),
                selectedGroupCount,
                confirmationTextMatched,
                blockedReasons.isEmpty(),
                joinReasons(blockedReasons)
        );
    }

    private String determineConfirmationTextStatus(List<String> groupBlockedReasons, String confirmationText) {
        if (!groupBlockedReasons.isEmpty()) {
            return CONFIRMATION_STATUS_NOT_APPLICABLE;
        }
        if (!StringUtils.hasText(confirmationText)) {
            return CONFIRMATION_STATUS_WAITING_INPUT;
        }
        return EXECUTE_CONFIRMATION_TEXT.equals(confirmationText)
                ? CONFIRMATION_STATUS_MATCHED
                : CONFIRMATION_STATUS_MISMATCHED;
    }

    private List<String> findDetectedItemPaths(List<RestoreDetectedItemResponse> detectedItems, String itemType) {
        return detectedItems.stream()
                .filter(item -> itemType.equals(item.itemType()))
                .findFirst()
                .map(RestoreDetectedItemResponse::relativePaths)
                .orElse(List.of());
    }

    private RestoreHistoryListItemResponse buildRestoreHistoryListItemResponse(RestoreHistory history) {
        ExecutionCapabilityResult executionCapability = resolveListExecutionCapability(history);
        return new RestoreHistoryListItemResponse(
                history.getId(),
                history.getStatus().name(),
                history.getFileName(),
                history.getFileSizeBytes(),
                SeoulDateTimeSupport.formatDateTime(history.getUploadedAt()),
                SeoulDateTimeSupport.formatDateTime(history.getValidatedAt()),
                history.getUploadedByNameSnapshot(),
                history.getFormatVersion(),
                history.getDatasourceType(),
                history.getBackupId(),
                history.getFailureReason(),
                executionCapability.executionCapability(),
                executionCapability.executionBlockedReason()
        );
    }

    private ExecutionCapabilityResult resolveListExecutionCapability(RestoreHistory history) {
        if (!canInspectArchive(history)) {
            return blockedExecutionCapability(EXECUTION_CAPABILITY_UNAVAILABLE_REASON);
        }
        try {
            return resolveExecutionCapability(history, resolveStoredValidationResult(history));
        } catch (RuntimeException exception) {
            return blockedExecutionCapability(EXECUTION_CAPABILITY_RECHECK_UNAVAILABLE_REASON);
        }
    }

    private ExecutionCapabilityResult resolveExecutionCapability(RestoreHistory history, ValidationResult validationResult) {
        if (validationResult == null) {
            return blockedExecutionCapability(EXECUTION_CAPABILITY_UNAVAILABLE_REASON);
        }
        return resolveExecutionCapability(validationResult);
    }

    private ExecutionCapabilityResult resolveExecutionCapability(ValidationResult validationResult) {
        return evaluateExecutionCapability(
                validationResult.datasourceType(),
                findDetectedItemPaths(validationResult.detectedItems(), DATABASE_ITEM_TYPE)
        );
    }

    private ExecutionCapabilityResult evaluateExecutionCapability(String archiveDatasourceType, List<String> databasePaths) {
        String normalizedArchiveDatasourceType = normalizeDatasourceType(archiveDatasourceType);
        String runtimeDatasourceType = determineDatasourceType(datasourceUrl);
        boolean archiveDatasourceSupported = isSupportedImportDatasource(normalizedArchiveDatasourceType);
        boolean runtimeDatasourceSupported = isSupportedImportDatasource(runtimeDatasourceType);
        List<String> blockedReasons = new ArrayList<>();

        if (databasePaths.isEmpty()) {
            blockedReasons.add("업로드한 ZIP 에 db/database.sql 이 없어 DATABASE 복원 그룹을 만들 수 없습니다.");
        }
        if (StringUtils.hasText(normalizedArchiveDatasourceType) && !archiveDatasourceSupported) {
            blockedReasons.add("업로드한 ZIP datasourceType=" + normalizedArchiveDatasourceType
                    + " 는 현재 버전에서 지원하지 않습니다. MariaDB/MySQL DATABASE 복원만 지원합니다.");
        }
        if (!runtimeDatasourceSupported) {
            blockedReasons.add("현재 서버 datasourceType=" + runtimeDatasourceType
                    + " 에서는 실제 복원을 실행할 수 없습니다. MariaDB/MySQL DATABASE 복원만 지원합니다.");
        }

        if (blockedReasons.isEmpty()) {
            return new ExecutionCapabilityResult(EXECUTION_CAPABILITY_EXECUTABLE, null, List.of());
        }
        return new ExecutionCapabilityResult(
                EXECUTION_CAPABILITY_BLOCKED,
                joinReasons(blockedReasons),
                List.copyOf(blockedReasons)
        );
    }

    private ExecutionCapabilityResult blockedExecutionCapability(String reason) {
        return new ExecutionCapabilityResult(
                EXECUTION_CAPABILITY_BLOCKED,
                reason,
                List.of(reason)
        );
    }

    private String joinReasons(List<String> reasons) {
        List<String> normalizedReasons = reasons.stream()
                .filter(StringUtils::hasText)
                .distinct()
                .toList();
        if (normalizedReasons.isEmpty()) {
            return null;
        }
        if (normalizedReasons.size() == 1) {
            return normalizedReasons.get(0);
        }
        return String.join("\n", normalizedReasons);
    }

    private void assertExecutableSelection(List<String> selectedItemTypes, List<RestoreDetectedItemResponse> detectedItems) {
        if (selectedItemTypes.isEmpty()) {
            throw new AppException(HttpStatus.BAD_REQUEST, "RESTORE_ITEM_SELECTION_INVALID", "복원 대상 항목을 하나 이상 선택해주세요.");
        }

        if (!EXECUTABLE_ITEM_TYPES.containsAll(selectedItemTypes)) {
            throw new AppException(HttpStatus.BAD_REQUEST, "RESTORE_UNSUPPORTED_ITEM_TYPE",
                    "현재 버전에서는 DATABASE 그룹만 실제 복원할 수 있습니다.");
        }

        Set<String> detectedItemTypes = detectedItems.stream()
                .map(RestoreDetectedItemResponse::itemType)
                .collect(java.util.stream.Collectors.toCollection(LinkedHashSet::new));
        if (!detectedItemTypes.containsAll(selectedItemTypes)) {
            throw new AppException(HttpStatus.BAD_REQUEST, "RESTORE_ITEM_SELECTION_INVALID",
                    "선택한 복원 대상이 저장된 ZIP 에 존재하지 않습니다.");
        }
    }

    private void assertConfirmationText(String confirmationText) {
        if (!EXECUTE_CONFIRMATION_TEXT.equals(confirmationText)) {
            throw new AppException(HttpStatus.BAD_REQUEST, "RESTORE_CONFIRMATION_TEXT_MISMATCH",
                    "확인 문구는 정확히 " + EXECUTE_CONFIRMATION_TEXT + " 이어야 합니다.");
        }
    }

    private List<String> normalizeSelectedItemTypes(List<String> selectedItemTypes) {
        if (selectedItemTypes == null) {
            return List.of();
        }
        return selectedItemTypes.stream()
                .filter(StringUtils::hasText)
                .map(String::trim)
                .filter(StringUtils::hasText)
                .map(value -> value.toUpperCase(Locale.ROOT))
                .distinct()
                .toList();
    }

    private List<String> parseSelectedItemTypes(String selectedItemTypes) {
        if (!StringUtils.hasText(selectedItemTypes)) {
            return List.of();
        }
        return List.of(selectedItemTypes.split(",")).stream()
                .map(String::trim)
                .filter(StringUtils::hasText)
                .toList();
    }

    private RestoreExecuteResponse buildExecuteResponse(RestoreHistory history, String message) {
        return new RestoreExecuteResponse(
                history.getId(),
                history.getStatus().name(),
                history.getExecutedAt(),
                parseSelectedItemTypes(history.getSelectedItemTypes()),
                history.getPreBackupId(),
                history.getPreBackupFileName(),
                message,
                history.getFailureReason()
        );
    }

    private void executeDatabaseRestore(Path archivePath, String archiveDatasourceType) throws Exception {
        if (!isSupportedImportDatasource(archiveDatasourceType)) {
            throw new IOException("Unsupported archive datasource type: " + archiveDatasourceType);
        }

        String executable = resolveImportExecutable();
        if (executable == null) {
            throw new IOException("DB import command is not available.");
        }

        JdbcConnectionInfo connectionInfo = parseJdbcConnectionInfo(datasourceUrl);
        Path databaseSqlFile = extractDatabaseSqlFile(archivePath);

        try {
            List<String> command = buildCommandInvocation(
                    executable,
                    List.of(
                            "--host=" + connectionInfo.host(),
                            "--port=" + connectionInfo.port(),
                            "--user=" + datasourceUsername,
                            connectionInfo.database()
                    )
            );

            ProcessBuilder processBuilder = new ProcessBuilder(command);
            processBuilder.redirectInput(databaseSqlFile.toFile());
            if (datasourcePassword != null && !datasourcePassword.isBlank()) {
                processBuilder.environment().put("MYSQL_PWD", datasourcePassword);
            }

            Process process = processBuilder.start();
            String stderr;
            try (InputStream errorStream = process.getErrorStream()) {
                if (!process.waitFor(dbImportTimeoutSeconds, TimeUnit.SECONDS)) {
                    process.destroyForcibly();
                    throw new IOException("DB import timed out after " + dbImportTimeoutSeconds + " seconds.");
                }
                stderr = new String(errorStream.readAllBytes(), StandardCharsets.UTF_8).trim();
            }

            if (process.exitValue() != 0) {
                throw new IOException("DB import failed with exit code " + process.exitValue() + (stderr.isBlank() ? "" : " - " + stderr));
            }
        } finally {
            Files.deleteIfExists(databaseSqlFile);
        }
    }

    private Path extractDatabaseSqlFile(Path archivePath) throws Exception {
        Path tempFile = Files.createTempFile("restore-database-", ".sql");
        try (ZipFile zipFile = new ZipFile(archivePath.toFile(), StandardCharsets.UTF_8)) {
            ZipEntry databaseEntry = zipFile.getEntry(DATABASE_SQL_PATH);
            if (databaseEntry == null) {
                throw new IOException(DATABASE_SQL_PATH + " entry is missing.");
            }
            try (InputStream inputStream = zipFile.getInputStream(databaseEntry)) {
                Files.copy(inputStream, tempFile, java.nio.file.StandardCopyOption.REPLACE_EXISTING);
            }
            return tempFile;
        } catch (Exception exception) {
            Files.deleteIfExists(tempFile);
            throw exception;
        }
    }

    private boolean isSupportedImportDatasource(String datasourceType) {
        return "MARIADB".equals(datasourceType) || "MYSQL".equals(datasourceType);
    }

    private String normalizeDatasourceType(String datasourceType) {
        return datasourceType == null ? "" : datasourceType.trim().toUpperCase(Locale.ROOT);
    }

    private String determineDatasourceType(String jdbcUrl) {
        if (jdbcUrl == null) {
            return "UNKNOWN";
        }
        if (jdbcUrl.startsWith("jdbc:mariadb://")) {
            return "MARIADB";
        }
        if (jdbcUrl.startsWith("jdbc:mysql://")) {
            return "MYSQL";
        }
        if (jdbcUrl.startsWith("jdbc:h2:")) {
            return "H2";
        }
        return "OTHER";
    }

    private JdbcConnectionInfo parseJdbcConnectionInfo(String jdbcUrl) throws IOException {
        if (!StringUtils.hasText(jdbcUrl)) {
            throw new IOException("Datasource URL is missing.");
        }
        try {
            URI uri = URI.create(jdbcUrl.substring("jdbc:".length()));
            String database = uri.getPath();
            if (database == null || database.isBlank() || "/".equals(database)) {
                throw new IOException("Database name is missing in datasource URL.");
            }
            return new JdbcConnectionInfo(
                    uri.getHost(),
                    uri.getPort() > 0 ? uri.getPort() : 3306,
                    database.startsWith("/") ? database.substring(1) : database
            );
        } catch (IOException exception) {
            throw exception;
        } catch (Exception exception) {
            throw new IOException("DB 연결 정보 해석에 실패했습니다.", exception);
        }
    }

    private String resolveImportExecutable() {
        if (dbImportCommand != null && !dbImportCommand.isBlank()) {
            String configured = dbImportCommand.trim();
            return isExecutableAvailable(configured) ? configured : null;
        }
        for (String candidate : List.of("mariadb", "mysql")) {
            if (isExecutableAvailable(candidate)) {
                return candidate;
            }
        }
        return null;
    }

    private boolean isExecutableAvailable(String candidate) {
        try {
            Process process = new ProcessBuilder(buildCommandInvocation(candidate, List.of("--version"))).start();
            return process.waitFor(5, TimeUnit.SECONDS) && process.exitValue() == 0;
        } catch (Exception exception) {
            return false;
        }
    }

    private List<String> buildCommandInvocation(String executable, List<String> args) {
        if (isWindowsScript(executable)) {
            List<String> command = new ArrayList<>();
            command.add("cmd.exe");
            command.add("/c");
            command.add(executable);
            command.addAll(args);
            return command;
        }
        List<String> command = new ArrayList<>();
        command.add(executable);
        command.addAll(args);
        return command;
    }

    private boolean isWindowsScript(String executable) {
        String normalized = executable.toLowerCase(Locale.ROOT);
        return isWindows() && (normalized.endsWith(".cmd") || normalized.endsWith(".bat"));
    }

    private boolean isWindows() {
        return System.getProperty("os.name", "").toLowerCase(Locale.ROOT).contains("windows");
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
                .anyMatch(entry -> DATABASE_SQL_PATH.equals(entry.relativePath()));
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

        List<String> databasePaths = filterPaths(entries, path -> DATABASE_SQL_PATH.equals(path));
        if (!databasePaths.isEmpty()) {
            detectedItems.add(new RestoreDetectedItemResponse(DATABASE_ITEM_TYPE, databasePaths));
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

    private RestoreStatus parseRestoreStatus(String status) {
        if (status == null || status.isBlank()) {
            return null;
        }
        try {
            return RestoreStatus.valueOf(status.trim().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException exception) {
            throw new AppException(HttpStatus.BAD_REQUEST, "VALIDATION_ERROR", "허용되지 않은 복원 상태입니다.");
        }
    }

    private record ValidationResult(
            String formatVersion,
            String datasourceType,
            Long backupId,
            List<RestoreDetectedItemResponse> detectedItems
    ) {
    }

    private record RestoreExecutionContext(
            RestoreHistory history,
            String archiveDatasourceType,
            List<String> selectedItemTypes
    ) {
    }

    private record ExecutionCapabilityResult(
            String executionCapability,
            String executionBlockedReason,
            List<String> blockedReasons
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

    private record JdbcConnectionInfo(String host, int port, String database) {
    }
}
