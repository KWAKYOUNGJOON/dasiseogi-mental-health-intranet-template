package com.dasisuhgi.mentalhealth.statistics.service;

import com.dasisuhgi.mentalhealth.common.config.ExportProperties;
import com.dasisuhgi.mentalhealth.common.error.AppException;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.InvalidPathException;
import java.nio.file.Path;
import java.nio.file.StandardOpenOption;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

@Service
public class ExportTempFileService {
    private static final Logger log = LoggerFactory.getLogger(ExportTempFileService.class);

    private final ExportProperties exportProperties;

    public ExportTempFileService(ExportProperties exportProperties) {
        this.exportProperties = exportProperties;
    }

    public byte[] materializeBytes(String prefix, String suffix, byte[] content) {
        Path tempFile = createTempFile(prefix, suffix);
        try {
            Files.write(tempFile, content, StandardOpenOption.TRUNCATE_EXISTING);
            return Files.readAllBytes(tempFile);
        } catch (IOException | SecurityException exception) {
            log.error("Failed to write export temp file '{}'", tempFile, exception);
            throw new AppException(
                    HttpStatus.INTERNAL_SERVER_ERROR,
                    "EXPORT_TEMP_FILE_WRITE_FAILED",
                    "export 임시 파일 쓰기에 실패했습니다."
            );
        } finally {
            deleteQuietly(tempFile);
        }
    }

    public Path createTempFile(String prefix, String suffix) {
        Path tempDirectory = ensureTempDirectory();
        String safePrefix = buildPrefix(prefix);
        try {
            Path tempFile = Files.createTempFile(tempDirectory, safePrefix, suffix);
            log.debug("Created export temp file at '{}'", tempFile);
            return tempFile;
        } catch (IOException | SecurityException exception) {
            log.error("Failed to create export temp file under '{}'", tempDirectory, exception);
            throw new AppException(
                    HttpStatus.INTERNAL_SERVER_ERROR,
                    "EXPORT_TEMP_PATH_UNAVAILABLE",
                    "export 임시 경로를 사용할 수 없습니다."
            );
        }
    }

    public void deleteQuietly(Path tempFile) {
        if (tempFile == null) {
            return;
        }
        try {
            Files.deleteIfExists(tempFile);
        } catch (IOException exception) {
            log.warn("Failed to delete export temp file '{}'", tempFile, exception);
        }
    }

    private Path ensureTempDirectory() {
        try {
            Path tempDirectory = resolveConfiguredTempDirectory();
            if (Files.exists(tempDirectory) && !Files.isDirectory(tempDirectory)) {
                log.error("Configured export temp path is not a directory: '{}'", tempDirectory);
                throw new AppException(
                        HttpStatus.INTERNAL_SERVER_ERROR,
                        "EXPORT_TEMP_PATH_UNAVAILABLE",
                        "export 임시 경로를 사용할 수 없습니다."
                );
            }

            Files.createDirectories(tempDirectory);

            if (!Files.isWritable(tempDirectory)) {
                log.error("Configured export temp path is not writable: '{}'", tempDirectory);
                throw new AppException(
                        HttpStatus.INTERNAL_SERVER_ERROR,
                        "EXPORT_TEMP_PATH_UNAVAILABLE",
                        "export 임시 경로를 사용할 수 없습니다."
                );
            }

            return tempDirectory;
        } catch (AppException exception) {
            throw exception;
        } catch (IOException | InvalidPathException | SecurityException exception) {
            log.error("Failed to prepare export temp directory from configured path '{}'", exportProperties.getTempPath(), exception);
            throw new AppException(
                    HttpStatus.INTERNAL_SERVER_ERROR,
                    "EXPORT_TEMP_PATH_UNAVAILABLE",
                    "export 임시 경로를 사용할 수 없습니다."
            );
        }
    }

    private Path resolveConfiguredTempDirectory() {
        String configuredPath = ExportProperties.DEFAULT_TEMP_PATH;
        String tempPath = exportProperties.getTempPath();
        if (tempPath != null && !tempPath.isBlank()) {
            configuredPath = tempPath.trim();
        }
        return Path.of(configuredPath).toAbsolutePath().normalize();
    }

    private String buildPrefix(String prefix) {
        String normalized = "export";
        if (prefix != null && !prefix.isBlank()) {
            normalized = prefix.trim();
        }
        if (normalized.length() >= 3) {
            return normalized;
        }
        return (normalized + "---").substring(0, 3);
    }
}
