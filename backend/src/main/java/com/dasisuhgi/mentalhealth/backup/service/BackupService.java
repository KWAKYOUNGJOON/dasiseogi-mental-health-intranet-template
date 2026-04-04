package com.dasisuhgi.mentalhealth.backup.service;

import com.dasisuhgi.mentalhealth.assessment.repository.AssessmentSessionRepository;
import com.dasisuhgi.mentalhealth.audit.entity.ActivityActionType;
import com.dasisuhgi.mentalhealth.audit.entity.ActivityTargetType;
import com.dasisuhgi.mentalhealth.audit.service.ActivityLogService;
import com.dasisuhgi.mentalhealth.backup.dto.BackupHistoryListItemResponse;
import com.dasisuhgi.mentalhealth.backup.dto.ManualBackupRunRequest;
import com.dasisuhgi.mentalhealth.backup.dto.ManualBackupRunResponse;
import com.dasisuhgi.mentalhealth.backup.entity.BackupHistory;
import com.dasisuhgi.mentalhealth.backup.entity.BackupMethod;
import com.dasisuhgi.mentalhealth.backup.entity.BackupStatus;
import com.dasisuhgi.mentalhealth.backup.entity.BackupType;
import com.dasisuhgi.mentalhealth.backup.repository.BackupHistoryQueryRepository;
import com.dasisuhgi.mentalhealth.backup.repository.BackupHistoryRepository;
import com.dasisuhgi.mentalhealth.client.repository.ClientRepository;
import com.dasisuhgi.mentalhealth.common.api.PageResponse;
import com.dasisuhgi.mentalhealth.common.config.ScaleProperties;
import com.dasisuhgi.mentalhealth.common.error.AppException;
import com.dasisuhgi.mentalhealth.common.security.AccessPolicyService;
import com.dasisuhgi.mentalhealth.common.session.SessionUser;
import com.dasisuhgi.mentalhealth.common.time.SeoulDateTimeSupport;
import com.dasisuhgi.mentalhealth.user.entity.User;
import com.dasisuhgi.mentalhealth.user.repository.UserRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.IOException;
import java.io.InputStream;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZonedDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HexFormat;
import java.util.List;
import java.util.Locale;
import java.util.Objects;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.zip.ZipEntry;
import java.util.zip.ZipOutputStream;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.Resource;
import org.springframework.core.env.Environment;
import org.springframework.core.io.support.PathMatchingResourcePatternResolver;
import org.springframework.http.HttpStatus;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class BackupService {
    private static final DateTimeFormatter FILE_FORMAT = DateTimeFormatter.ofPattern("yyyyMMdd-HHmmss");
    private static final String FORMAT_VERSION = "FULL_BACKUP_ZIP_V1";
    private static final String SYSTEM_EXECUTOR = "SYSTEM";

    private final BackupHistoryRepository backupHistoryRepository;
    private final BackupHistoryQueryRepository backupHistoryQueryRepository;
    private final AccessPolicyService accessPolicyService;
    private final ActivityLogService activityLogService;
    private final UserRepository userRepository;
    private final ClientRepository clientRepository;
    private final AssessmentSessionRepository assessmentSessionRepository;
    private final PathMatchingResourcePatternResolver resourceResolver = new PathMatchingResourcePatternResolver();
    private final ObjectMapper objectMapper;
    private final ScaleProperties scaleProperties;
    private final Environment environment;
    private final String backupRootPath;
    private final String datasourceUrl;
    private final String datasourceUsername;
    private final String datasourcePassword;
    private final String dbDumpCommand;
    private final boolean backupAutoEnabled;
    private final AtomicBoolean backupRunning = new AtomicBoolean(false);

    public BackupService(
            BackupHistoryRepository backupHistoryRepository,
            BackupHistoryQueryRepository backupHistoryQueryRepository,
            AccessPolicyService accessPolicyService,
            ActivityLogService activityLogService,
            UserRepository userRepository,
            ClientRepository clientRepository,
            AssessmentSessionRepository assessmentSessionRepository,
            ObjectMapper objectMapper,
            ScaleProperties scaleProperties,
            Environment environment,
            @Value("${app.backup.root-path:./local-backups}") String backupRootPath,
            @Value("${spring.datasource.url}") String datasourceUrl,
            @Value("${spring.datasource.username:}") String datasourceUsername,
            @Value("${spring.datasource.password:}") String datasourcePassword,
            @Value("${app.backup.db-dump-command:}") String dbDumpCommand,
            @Value("${app.backup.auto.enabled:true}") boolean backupAutoEnabled
    ) {
        this.backupHistoryRepository = backupHistoryRepository;
        this.backupHistoryQueryRepository = backupHistoryQueryRepository;
        this.accessPolicyService = accessPolicyService;
        this.activityLogService = activityLogService;
        this.userRepository = userRepository;
        this.clientRepository = clientRepository;
        this.assessmentSessionRepository = assessmentSessionRepository;
        this.objectMapper = objectMapper;
        this.scaleProperties = scaleProperties;
        this.environment = environment;
        this.backupRootPath = backupRootPath;
        this.datasourceUrl = datasourceUrl;
        this.datasourceUsername = datasourceUsername;
        this.datasourcePassword = datasourcePassword;
        this.dbDumpCommand = dbDumpCommand;
        this.backupAutoEnabled = backupAutoEnabled;
    }

    @Transactional(readOnly = true)
    public PageResponse<BackupHistoryListItemResponse> getBackups(
            String backupType,
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
        User currentUser = accessPolicyService.getCurrentUser(sessionUser);
        accessPolicyService.assertAdmin(currentUser);
        return backupHistoryQueryRepository.findBackups(parseBackupType(backupType), parseBackupStatus(status), dateFrom, dateTo, page, size);
    }

    @Transactional(noRollbackFor = Exception.class)
    public ManualBackupRunResponse runManualBackup(ManualBackupRunRequest request, SessionUser sessionUser) {
        User currentUser = accessPolicyService.getCurrentUser(sessionUser);
        accessPolicyService.assertAdmin(currentUser);
        return executeBackup(BackupType.MANUAL, request == null ? null : request.reason(), currentUser);
    }

    @Transactional(noRollbackFor = Exception.class)
    public ManualBackupRunResponse runPreRestoreBackup(String reason, User currentUser) {
        return executeBackup(BackupType.MANUAL, reason, currentUser);
    }

    @Scheduled(cron = "${app.backup.auto.cron:0 0 2 * * *}", zone = "${app.backup.auto.zone:Asia/Seoul}")
    @Transactional(noRollbackFor = Exception.class)
    public void runAutomaticBackup() {
        if (!backupAutoEnabled) {
            return;
        }
        executeBackup(BackupType.AUTO, "scheduled automatic backup", null);
    }

    private ManualBackupRunResponse executeBackup(BackupType backupType, String reason, User currentUser) {
        if (!backupRunning.compareAndSet(false, true)) {
            if (backupType == BackupType.AUTO) {
                return null;
            }
            throw new AppException(HttpStatus.CONFLICT, "BACKUP_ALREADY_RUNNING", "이미 백업이 실행 중입니다.");
        }

        try {
            LocalDateTime startedAt = SeoulDateTimeSupport.now();
            Path root = Path.of(backupRootPath).toAbsolutePath().normalize();

            BackupHistory history = new BackupHistory();
            history.setBackupType(backupType);
            history.setBackupMethod(BackupMethod.SNAPSHOT);
            history.setStatus(BackupStatus.FAILED);
            history.setFileName("backup-" + FILE_FORMAT.format(startedAt) + "-pending.tmp");
            history.setFilePath(root.resolve(history.getFileName()).toString());
            history.setStartedAt(startedAt);
            history.setExecutedById(currentUser == null ? null : currentUser.getId());
            history.setExecutedByNameSnapshot(currentUser == null ? "SYSTEM" : currentUser.getName());
            backupHistoryRepository.save(history);

            try {
                BackupPreflight preflight = performPreflight(root);
                history.setBackupMethod(preflight.preferredMethod());
                BackupArtifact artifact = createBackupArtifact(history, preflight, root, startedAt, reason, currentUser);
                history.setBackupMethod(artifact.method());
                history.setFileName(artifact.fileName());
                history.setFilePath(artifact.filePath().toString());
                history.setStatus(BackupStatus.SUCCESS);
                history.setFileSizeBytes(Files.size(artifact.filePath()));
                history.setCompletedAt(SeoulDateTimeSupport.now());
                history.setFailureReason(null);
                backupHistoryRepository.save(history);

                activityLogService.log(
                        currentUser,
                        ActivityActionType.BACKUP_RUN,
                        ActivityTargetType.BACKUP,
                        history.getId(),
                        history.getFileName(),
                        (backupType == BackupType.AUTO ? "자동" : "수동") + " 백업 실행: " + history.getBackupMethod().name() + " / " + history.getFileName()
                );

                if (backupType == BackupType.AUTO) {
                    return null;
                }
                return new ManualBackupRunResponse(
                        history.getId(),
                        history.getBackupType().name(),
                        history.getBackupMethod().name(),
                        preflight.datasourceType(),
                        preflight.summary(),
                        history.getStatus().name(),
                        history.getFileName(),
                        history.getFilePath()
                );
            } catch (Exception exception) {
                history.setCompletedAt(SeoulDateTimeSupport.now());
                history.setFailureReason(buildFailureReason(exception));
                backupHistoryRepository.save(history);
                if (backupType == BackupType.AUTO) {
                    return null;
                }
                if (exception instanceof AppException appException) {
                    throw appException;
                }
                throw new AppException(HttpStatus.INTERNAL_SERVER_ERROR, "BACKUP_RUN_FAILED", "백업 실행에 실패했습니다.");
            }
        } finally {
            backupRunning.set(false);
        }
    }

    private BackupArtifact createBackupArtifact(
            BackupHistory history,
            BackupPreflight preflight,
            Path root,
            LocalDateTime startedAt,
            String reason,
            User currentUser
    ) throws Exception {
        Path tempDatabaseDumpFile = null;
        try {
            if (preflight.preferredMethod() == BackupMethod.DB_DUMP) {
                tempDatabaseDumpFile = writeDatabaseDumpFile(preflight, root, startedAt);
            }
            return writeStandardBackupZip(history, preflight, root, startedAt, reason, currentUser, tempDatabaseDumpFile);
        } finally {
            if (tempDatabaseDumpFile != null) {
                Files.deleteIfExists(tempDatabaseDumpFile);
            }
        }
    }

    private Path writeDatabaseDumpFile(
            BackupPreflight preflight,
            Path root,
            LocalDateTime startedAt
    ) throws Exception {
        if (preflight.preferredMethod() == BackupMethod.DB_DUMP) {
            return tryDatabaseDump(preflight, root, startedAt);
        }
        return null;
    }

    private Path tryDatabaseDump(
            BackupPreflight preflight,
            Path root,
            LocalDateTime startedAt
    ) throws Exception {
        JdbcConnectionInfo info = parseJdbcConnectionInfo(datasourceUrl);
        Path filePath = root.resolve("backup-" + FILE_FORMAT.format(startedAt) + "-database.sql.tmp");
        List<String> command = buildCommandInvocation(
                preflight.dumpCommand(),
                List.of(
                        "--host=" + info.host(),
                        "--port=" + info.port(),
                        "--user=" + datasourceUsername,
                        "--single-transaction",
                        "--skip-lock-tables",
                        "--skip-comments",
                        "--result-file=" + filePath.toString(),
                        info.database()
                )
        );

        ProcessBuilder processBuilder = new ProcessBuilder(command);
        if (datasourcePassword != null && !datasourcePassword.isBlank()) {
            processBuilder.environment().put("MYSQL_PWD", datasourcePassword);
        }

        Process process = processBuilder.start();
        String stderr;
        try (InputStream errorStream = process.getErrorStream()) {
            if (!process.waitFor(30, TimeUnit.SECONDS)) {
                process.destroyForcibly();
                throw new IOException("DB dump timed out after 30 seconds.");
            }
            stderr = new String(errorStream.readAllBytes(), StandardCharsets.UTF_8).trim();
        }

        if (process.exitValue() != 0) {
            throw new IOException("DB dump failed with exit code " + process.exitValue() + (stderr.isBlank() ? "" : " - " + stderr));
        }
        if (!Files.exists(filePath)) {
            throw new IOException("DB dump output file was not created.");
        }
        return filePath;
    }

    private BackupArtifact writeStandardBackupZip(
            BackupHistory history,
            BackupPreflight preflight,
            Path root,
            LocalDateTime startedAt,
            String reason,
            User currentUser,
            Path databaseDumpFile
    ) throws IOException {
        BackupMethod backupMethod = databaseDumpFile == null ? BackupMethod.SNAPSHOT : BackupMethod.DB_DUMP;
        String fileName = "backup-" + FILE_FORMAT.format(startedAt) + "-" + methodFileToken(backupMethod) + "-full-v1.zip";
        Path filePath = root.resolve(fileName);
        String createdAt = ZonedDateTime.now(SeoulDateTimeSupport.zoneId()).format(DateTimeFormatter.ISO_OFFSET_DATE_TIME);
        ExecutedBySummary executedBy = buildExecutedBy(currentUser);
        BackupContentSummary summary = buildSummary(history, preflight, backupMethod, databaseDumpFile != null, reason);

        List<PreparedBackupEntry> payloadEntries = new ArrayList<>();
        if (databaseDumpFile != null) {
            payloadEntries.add(PreparedBackupEntry.fromPath("DATABASE_DUMP", "db/database.sql", databaseDumpFile));
        }
        addClasspathResource(payloadEntries, "CONFIG_FILE", "classpath:application.yml", "config/application.yml");
        addClasspathResource(payloadEntries, "CONFIG_FILE", "classpath:application-prod.yml", "config/application-prod.yml");
        payloadEntries.addAll(loadScaleEntries());
        payloadEntries.add(PreparedBackupEntry.fromBytes(
                "METADATA_SUMMARY",
                "metadata/summary.json",
                serializeJson(new BackupMetadataSummary(
                        FORMAT_VERSION,
                        createdAt,
                        preflight.datasourceType(),
                        resolveAppVersion(),
                        history.getId(),
                        executedBy,
                        resolveProfile(),
                        resolveEnvironment(),
                        summary
                ))
        ));

        List<BackupEntryDescriptor> descriptors = payloadEntries.stream()
                .map(this::createEntryDescriptor)
                .toList();
        byte[] manifestBytes = serializeJson(new StandardBackupManifest(
                FORMAT_VERSION,
                createdAt,
                preflight.datasourceType(),
                resolveAppVersion(),
                history.getId(),
                executedBy,
                resolveProfile(),
                resolveEnvironment(),
                summary,
                descriptors
        ));

        try (ZipOutputStream outputStream = new ZipOutputStream(Files.newOutputStream(filePath), StandardCharsets.UTF_8)) {
            writeZipEntry(outputStream, PreparedBackupEntry.fromBytes("MANIFEST", "manifest.json", manifestBytes));
            for (PreparedBackupEntry payloadEntry : payloadEntries) {
                writeZipEntry(outputStream, payloadEntry);
            }
        } catch (IOException exception) {
            Files.deleteIfExists(filePath);
            throw exception;
        }
        return new BackupArtifact(backupMethod, fileName, filePath);
    }

    private void addClasspathResource(
            List<PreparedBackupEntry> payloadEntries,
            String itemType,
            String resourceLocation,
            String relativePath
    ) throws IOException {
        Resource resource = resourceResolver.getResource(Objects.requireNonNull(resourceLocation, "resourceLocation"));
        if (!resource.exists()) {
            return;
        }
        payloadEntries.add(PreparedBackupEntry.fromBytes(itemType, relativePath, readResourceBytes(resource)));
    }

    private List<PreparedBackupEntry> loadScaleEntries() throws IOException {
        String configuredPath = normalizeScaleResourcePath(scaleProperties.getResourcePath());
        if (configuredPath.startsWith("classpath:")) {
            return loadClasspathScaleEntries(configuredPath);
        }
        return loadFilesystemScaleEntries(Path.of(configuredPath).toAbsolutePath().normalize());
    }

    private List<PreparedBackupEntry> loadClasspathScaleEntries(String classpathBase) throws IOException {
        String searchPattern = "classpath*:" + trimLeadingSlashes(classpathBase.substring("classpath:".length())) + "/**/*.json";
        List<Resource> resources = List.of(resourceResolver.getResources(searchPattern)).stream()
                .filter(Resource::exists)
                .sorted(Comparator.comparing(this::resourceDescription))
                .toList();
        List<PreparedBackupEntry> entries = new ArrayList<>();
        String normalizedSegment = "/" + trimLeadingSlashes(classpathBase.substring("classpath:".length())) + "/";
        for (Resource resource : resources) {
            String resourcePath = resourceDescription(resource);
            String relativePath = resolveScaleRelativePath(resource, resourcePath, normalizedSegment);
            entries.add(PreparedBackupEntry.fromBytes(
                    "SCALE_JSON",
                    "scales/" + relativePath,
                    readResourceBytes(resource)
            ));
        }
        return entries;
    }

    private List<PreparedBackupEntry> loadFilesystemScaleEntries(Path scaleRoot) throws IOException {
        if (!Files.isDirectory(scaleRoot)) {
            throw new IOException("Configured scale resource path is not a directory: " + scaleRoot);
        }
        try (var stream = Files.walk(scaleRoot)) {
            return stream
                    .filter(Files::isRegularFile)
                    .filter(path -> path.getFileName().toString().toLowerCase(Locale.ROOT).endsWith(".json"))
                    .sorted()
                    .map(path -> PreparedBackupEntry.fromPath(
                            "SCALE_JSON",
                            "scales/" + scaleRoot.relativize(path).toString().replace('\\', '/'),
                            path
                    ))
                    .toList();
        }
    }

    private String normalizeScaleResourcePath(String configuredPath) {
        String normalized = ScaleProperties.DEFAULT_RESOURCE_PATH;
        if (configuredPath != null && !configuredPath.isBlank()) {
            normalized = configuredPath.trim().replace('\\', '/');
        }
        while (normalized.endsWith("/")) {
            normalized = normalized.substring(0, normalized.length() - 1);
        }
        if ("classpath:".equals(normalized)) {
            return ScaleProperties.DEFAULT_RESOURCE_PATH;
        }
        return normalized;
    }

    private String resourceDescription(Resource resource) {
        try {
            return resource.getURL().toString().replace('\\', '/');
        } catch (IOException exception) {
            return resource.getDescription();
        }
    }

    private String resolveScaleRelativePath(Resource resource, String resourcePath, String normalizedSegment) {
        int index = resourcePath.indexOf(normalizedSegment);
        if (index >= 0) {
            return resourcePath.substring(index + normalizedSegment.length());
        }
        return Objects.requireNonNull(resource.getFilename(), "Classpath scale resource must have a filename");
    }

    private byte[] readResourceBytes(Resource resource) throws IOException {
        try (InputStream inputStream = resource.getInputStream()) {
            return inputStream.readAllBytes();
        }
    }

    private BackupContentSummary buildSummary(
            BackupHistory history,
            BackupPreflight preflight,
            BackupMethod backupMethod,
            boolean includesDatabaseDump,
            String reason
    ) {
        return new BackupContentSummary(
                history.getBackupType().name(),
                backupMethod.name(),
                preflight.datasourceType(),
                includesDatabaseDump,
                userRepository.count(),
                clientRepository.count(),
                assessmentSessionRepository.count(),
                normalizeNullableText(reason)
        );
    }

    private ExecutedBySummary buildExecutedBy(User currentUser) {
        if (currentUser == null) {
            return new ExecutedBySummary(null, SYSTEM_EXECUTOR, SYSTEM_EXECUTOR);
        }
        return new ExecutedBySummary(currentUser.getId(), currentUser.getLoginId(), currentUser.getName());
    }

    private String resolveAppVersion() {
        Package currentPackage = getClass().getPackage();
        String implementationVersion = currentPackage == null ? null : currentPackage.getImplementationVersion();
        if (implementationVersion != null && !implementationVersion.isBlank()) {
            return implementationVersion.trim();
        }
        String propertyValue = environment.getProperty("app.version");
        if (propertyValue != null && !propertyValue.isBlank()) {
            return propertyValue.trim();
        }
        return "unknown";
    }

    private String resolveProfile() {
        String[] activeProfiles = environment.getActiveProfiles();
        if (activeProfiles.length > 0) {
            return String.join(",", activeProfiles);
        }
        String[] defaultProfiles = environment.getDefaultProfiles();
        if (defaultProfiles.length > 0) {
            return String.join(",", defaultProfiles);
        }
        return "unknown";
    }

    @SuppressWarnings("null")
    private String resolveEnvironment() {
        for (String key : List.of("app.environment", "APP_ENVIRONMENT", "environment", "ENVIRONMENT")) {
            String value = environment.getProperty(key);
            if (value == null) {
                continue;
            }
            String normalized = value.trim();
            if (!normalized.isEmpty()) {
                return normalized;
            }
        }
        return "unknown";
    }

    private byte[] serializeJson(Object value) throws IOException {
        return Objects.requireNonNull(objectMapper.writerWithDefaultPrettyPrinter(), "prettyPrinterWriter")
                .writeValueAsBytes(value);
    }

    private BackupEntryDescriptor createEntryDescriptor(PreparedBackupEntry entry) {
        try (InputStream inputStream = entry.openStream()) {
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
            return new BackupEntryDescriptor(
                    entry.itemType(),
                    entry.relativePath(),
                    size,
                    HexFormat.of().formatHex(digest.digest())
            );
        } catch (IOException exception) {
            throw new IllegalStateException("Failed to read backup entry " + entry.relativePath(), exception);
        } catch (NoSuchAlgorithmException exception) {
            throw new IllegalStateException("SHA-256 digest is not available", exception);
        }
    }

    private void writeZipEntry(ZipOutputStream outputStream, PreparedBackupEntry entry) throws IOException {
        outputStream.putNextEntry(new ZipEntry(entry.relativePath()));
        try (InputStream inputStream = entry.openStream()) {
            inputStream.transferTo(outputStream);
        }
        outputStream.closeEntry();
    }

    private String normalizeNullableText(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        return value.trim();
    }

    private String methodFileToken(BackupMethod backupMethod) {
        return backupMethod == BackupMethod.DB_DUMP ? "db-dump" : "snapshot";
    }

    private String trimLeadingSlashes(String value) {
        String normalized = value;
        while (normalized.startsWith("/")) {
            normalized = normalized.substring(1);
        }
        return normalized;
    }

    private BackupPreflight performPreflight(Path root) {
        String datasourceType = determineDatasourceType();
        boolean dumpPreferred = "MARIADB".equals(datasourceType) || "MYSQL".equals(datasourceType);
        String configuredDumpCommand = dbDumpCommand == null || dbDumpCommand.isBlank() ? null : dbDumpCommand.trim();
        String dumpCommand = dumpPreferred ? resolveDumpExecutable() : null;
        boolean dumpCommandAvailable = dumpCommand != null;

        try {
            if (Files.exists(root) && !Files.isDirectory(root)) {
                throw new IOException("Backup path points to a file, not a directory.");
            }
            Files.createDirectories(root);
            Path probe = Files.createTempFile(root, "backup-preflight-", ".tmp");
            Files.deleteIfExists(probe);
        } catch (IOException exception) {
            throw new AppException(HttpStatus.INTERNAL_SERVER_ERROR, "BACKUP_PATH_NOT_WRITABLE",
                    "백업 경로를 사용할 수 없습니다: " + exception.getMessage());
        }

        BackupMethod preferredMethod = dumpPreferred && dumpCommandAvailable ? BackupMethod.DB_DUMP : BackupMethod.SNAPSHOT;
        String summary = "datasource=" + datasourceType
                + ", preferred=" + preferredMethod.name()
                + ", dumpCommand=" + describeDumpCommand(configuredDumpCommand, dumpCommand, dumpCommandAvailable)
                + ", dumpAvailable=" + dumpCommandAvailable
                + ", fallback=" + (dumpPreferred && !dumpCommandAvailable ? "SNAPSHOT" : "-");
        return new BackupPreflight(datasourceType, preferredMethod, dumpCommand, dumpCommandAvailable, summary);
    }

    private String determineDatasourceType() {
        if (datasourceUrl == null) {
            return "UNKNOWN";
        }
        if (datasourceUrl.startsWith("jdbc:mariadb://")) {
            return "MARIADB";
        }
        if (datasourceUrl.startsWith("jdbc:mysql://")) {
            return "MYSQL";
        }
        if (datasourceUrl.startsWith("jdbc:h2:")) {
            return "H2";
        }
        return "OTHER";
    }

    private JdbcConnectionInfo parseJdbcConnectionInfo(String jdbcUrl) {
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
        } catch (Exception exception) {
            throw new AppException(HttpStatus.INTERNAL_SERVER_ERROR, "BACKUP_RUN_FAILED", "DB 연결 정보 해석에 실패했습니다.");
        }
    }

    private String resolveDumpExecutable() {
        if (dbDumpCommand != null && !dbDumpCommand.isBlank()) {
            String configured = dbDumpCommand.trim();
            return isExecutableAvailable(configured) ? configured : null;
        }
        for (String candidate : List.of("mariadb-dump", "mysqldump")) {
            if (isExecutableAvailable(candidate)) {
                return candidate;
            }
        }
        return null;
    }

    private String describeDumpCommand(String configuredDumpCommand, String resolvedDumpCommand, boolean dumpCommandAvailable) {
        if (dumpCommandAvailable) {
            return resolvedDumpCommand;
        }
        if (configuredDumpCommand != null) {
            return configuredDumpCommand + " (missing)";
        }
        return "-";
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
            List<String> command = new java.util.ArrayList<>();
            command.add("cmd.exe");
            command.add("/c");
            command.add(executable);
            command.addAll(args);
            return command;
        }
        List<String> command = new java.util.ArrayList<>();
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

    private BackupType parseBackupType(String backupType) {
        if (backupType == null || backupType.isBlank()) {
            return null;
        }
        try {
            return BackupType.valueOf(backupType.trim().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException exception) {
            throw new AppException(HttpStatus.BAD_REQUEST, "VALIDATION_ERROR", "허용되지 않은 백업 유형입니다.");
        }
    }

    private BackupStatus parseBackupStatus(String status) {
        if (status == null || status.isBlank()) {
            return null;
        }
        try {
            return BackupStatus.valueOf(status.trim().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException exception) {
            throw new AppException(HttpStatus.BAD_REQUEST, "VALIDATION_ERROR", "허용되지 않은 백업 상태입니다.");
        }
    }

    private String buildFailureReason(Exception exception) {
        String message = exception.getMessage();
        String detailed = exception.getClass().getSimpleName() + (message == null || message.isBlank() ? "" : ": " + message);
        return detailed.length() > 500 ? detailed.substring(0, 500) : detailed;
    }

    private record BackupArtifact(BackupMethod method, String fileName, Path filePath) {
    }

    private record PreparedBackupEntry(
            String itemType,
            String relativePath,
            byte[] contentBytes,
            Path sourcePath
    ) {
        private static PreparedBackupEntry fromBytes(String itemType, String relativePath, byte[] contentBytes) {
            return new PreparedBackupEntry(itemType, relativePath, contentBytes, null);
        }

        private static PreparedBackupEntry fromPath(String itemType, String relativePath, Path sourcePath) {
            return new PreparedBackupEntry(itemType, relativePath, null, sourcePath);
        }

        private InputStream openStream() throws IOException {
            if (contentBytes != null) {
                return new java.io.ByteArrayInputStream(contentBytes);
            }
            return Files.newInputStream(sourcePath);
        }
    }

    private record JdbcConnectionInfo(String host, int port, String database) {
    }

    private record ExecutedBySummary(Long userId, String loginId, String name) {
    }

    private record BackupContentSummary(
            String backupType,
            String backupMethod,
            String datasourceType,
            boolean includesDatabaseDump,
            long userCount,
            long clientCount,
            long sessionCount,
            String reason
    ) {
    }

    private record BackupMetadataSummary(
            String formatVersion,
            String createdAt,
            String datasourceType,
            String appVersion,
            Long backupId,
            ExecutedBySummary executedBy,
            String profile,
            String environment,
            BackupContentSummary summary
    ) {
    }

    private record StandardBackupManifest(
            String formatVersion,
            String createdAt,
            String datasourceType,
            String appVersion,
            Long backupId,
            ExecutedBySummary executedBy,
            String profile,
            String environment,
            BackupContentSummary summary,
            List<BackupEntryDescriptor> entries
    ) {
    }

    private record BackupEntryDescriptor(
            String itemType,
            String relativePath,
            long size,
            String sha256
    ) {
    }

    private record BackupPreflight(
            String datasourceType,
            BackupMethod preferredMethod,
            String dumpCommand,
            boolean dumpCommandAvailable,
            String summary
    ) {
    }
}
