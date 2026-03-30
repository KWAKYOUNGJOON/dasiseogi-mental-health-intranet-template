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
import com.dasisuhgi.mentalhealth.common.error.AppException;
import com.dasisuhgi.mentalhealth.common.security.AccessPolicyService;
import com.dasisuhgi.mentalhealth.common.session.SessionUser;
import com.dasisuhgi.mentalhealth.user.entity.User;
import com.dasisuhgi.mentalhealth.user.repository.UserRepository;
import java.io.IOException;
import java.io.InputStream;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Locale;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.zip.ZipEntry;
import java.util.zip.ZipOutputStream;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.Resource;
import org.springframework.core.io.support.PathMatchingResourcePatternResolver;
import org.springframework.http.HttpStatus;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class BackupService {
    private static final DateTimeFormatter FILE_FORMAT = DateTimeFormatter.ofPattern("yyyyMMdd-HHmmss");

    private final BackupHistoryRepository backupHistoryRepository;
    private final BackupHistoryQueryRepository backupHistoryQueryRepository;
    private final AccessPolicyService accessPolicyService;
    private final ActivityLogService activityLogService;
    private final UserRepository userRepository;
    private final ClientRepository clientRepository;
    private final AssessmentSessionRepository assessmentSessionRepository;
    private final PathMatchingResourcePatternResolver resourceResolver = new PathMatchingResourcePatternResolver();
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
            LocalDateTime startedAt = LocalDateTime.now();
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
                BackupArtifact artifact = createBackupArtifact(preflight, root, startedAt, reason, currentUser);
                history.setBackupMethod(artifact.method());
                history.setFileName(artifact.fileName());
                history.setFilePath(artifact.filePath().toString());
                history.setStatus(BackupStatus.SUCCESS);
                history.setFileSizeBytes(Files.size(artifact.filePath()));
                history.setCompletedAt(LocalDateTime.now());
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
                history.setCompletedAt(LocalDateTime.now());
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
            BackupPreflight preflight,
            Path root,
            LocalDateTime startedAt,
            String reason,
            User currentUser
    ) throws Exception {
        if (preflight.preferredMethod() == BackupMethod.DB_DUMP) {
            return tryDatabaseDump(preflight, root, startedAt, reason, currentUser);
        }
        return writeSnapshotZip(root, startedAt, reason, currentUser);
    }

    private BackupArtifact tryDatabaseDump(
            BackupPreflight preflight,
            Path root,
            LocalDateTime startedAt,
            String reason,
            User currentUser
    ) throws Exception {
        JdbcConnectionInfo info = parseJdbcConnectionInfo(datasourceUrl);
        if (!preflight.dumpCommandAvailable()) {
            String fallbackReason = reason == null || reason.isBlank()
                    ? "DB dump command unavailable; snapshot fallback"
                    : reason + " / DB dump command unavailable; snapshot fallback";
            return writeSnapshotZip(root, startedAt, fallbackReason, currentUser);
        }

        String fileName = "backup-" + FILE_FORMAT.format(startedAt) + "-db-dump.sql";
        Path filePath = root.resolve(fileName);
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
        return new BackupArtifact(BackupMethod.DB_DUMP, fileName, filePath);
    }

    private BackupArtifact writeSnapshotZip(Path root, LocalDateTime startedAt, String reason, User currentUser) throws IOException {
        String fileName = "backup-" + FILE_FORMAT.format(startedAt) + "-snapshot.zip";
        Path filePath = root.resolve(fileName);
        try (ZipOutputStream outputStream = new ZipOutputStream(Files.newOutputStream(filePath), StandardCharsets.UTF_8)) {
            addTextEntry(outputStream, "metadata/summary.json", """
                    {
                      "generatedAt": "%s",
                      "executedBy": %s,
                      "reason": %s,
                      "backupMethod": "SNAPSHOT",
                      "userCount": %d,
                      "clientCount": %d,
                      "sessionCount": %d
                    }
                    """.formatted(
                    LocalDateTime.now(),
                    currentUser == null ? null : "\"" + currentUser.getLoginId() + "\"",
                    reason == null || reason.isBlank() ? null : "\"" + reason.replace("\"", "\\\"") + "\"",
                    userRepository.count(),
                    clientRepository.count(),
                    assessmentSessionRepository.count()
            ));
            copyResource(outputStream, resourceResolver.getResource("classpath:application.yml"), "config/application.yml");
            copyResource(outputStream, resourceResolver.getResource("classpath:application-prod.yml"), "config/application-prod.yml");
            for (Resource resource : resourceResolver.getResources("classpath*:scales/**/*.json")) {
                copyResource(outputStream, resource, resolveScaleEntryName(resource));
            }
        }
        return new BackupArtifact(BackupMethod.SNAPSHOT, fileName, filePath);
    }

    private void copyResource(ZipOutputStream outputStream, Resource resource, String entryName) throws IOException {
        if (!resource.exists()) {
            return;
        }
        outputStream.putNextEntry(new ZipEntry(entryName));
        try (InputStream inputStream = resource.getInputStream()) {
            inputStream.transferTo(outputStream);
        }
        outputStream.closeEntry();
    }

    private void addTextEntry(ZipOutputStream outputStream, String entryName, String content) throws IOException {
        outputStream.putNextEntry(new ZipEntry(entryName));
        outputStream.write(content.getBytes(StandardCharsets.UTF_8));
        outputStream.closeEntry();
    }

    private String resolveScaleEntryName(Resource resource) throws IOException {
        String path = resource.getURL().toString().replace('\\', '/');
        int index = path.indexOf("/scales/");
        if (index >= 0) {
            return path.substring(index + 1);
        }
        return "scales/" + resource.getFilename();
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

    private record JdbcConnectionInfo(String host, int port, String database) {
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
