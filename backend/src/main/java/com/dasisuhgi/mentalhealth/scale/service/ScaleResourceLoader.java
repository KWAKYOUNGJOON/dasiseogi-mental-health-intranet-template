package com.dasisuhgi.mentalhealth.scale.service;

import com.dasisuhgi.mentalhealth.common.config.ScaleProperties;
import com.dasisuhgi.mentalhealth.scale.registry.ScaleDefinition;
import com.dasisuhgi.mentalhealth.scale.registry.ScaleRegistryFile;
import com.dasisuhgi.mentalhealth.scale.registry.ScaleRegistryItem;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.InvalidPathException;
import java.nio.file.Path;
import java.util.LinkedHashMap;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.io.Resource;
import org.springframework.core.io.ResourceLoader;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

@Component
public class ScaleResourceLoader {
    private static final Logger log = LoggerFactory.getLogger(ScaleResourceLoader.class);
    private static final String CLASSPATH_PREFIX = "classpath:";
    private static final String DEFAULT_SCALE_ROOT = "scales";
    private static final String REGISTRY_RELATIVE_PATH = "common/scale-registry.json";

    private final ObjectMapper objectMapper;
    private final ResourceLoader resourceLoader;
    private final ScaleProperties scaleProperties;

    public ScaleResourceLoader(ObjectMapper objectMapper, ResourceLoader resourceLoader, ScaleProperties scaleProperties) {
        this.objectMapper = objectMapper;
        this.resourceLoader = resourceLoader;
        this.scaleProperties = scaleProperties;
    }

    public LoadedScaleResources load() {
        ScaleLocation scaleLocation;
        try {
            scaleLocation = ScaleLocation.from(scaleProperties.getResourcePath());
        } catch (InvalidPathException exception) {
            String configuredPath = StringUtils.hasText(scaleProperties.getResourcePath())
                    ? scaleProperties.getResourcePath().trim()
                    : ScaleProperties.DEFAULT_RESOURCE_PATH;
            throw fail("Invalid configured scale resource path: " + configuredPath, exception);
        }
        log.info("Loading scale resources from {}", scaleLocation.description());

        ScaleRegistryFile registryFile = readRegistry(scaleLocation);
        validateRegistryFile(registryFile, scaleLocation);

        Map<String, ScaleRegistryItem> registryItems = new LinkedHashMap<>();
        Map<String, ScaleDefinition> definitions = new LinkedHashMap<>();

        for (ScaleRegistryItem item : registryFile.items()) {
            validateRegistryItem(item, scaleLocation);
            if (registryItems.putIfAbsent(item.scaleCode(), item) != null) {
                throw fail("Duplicate scaleCode '" + item.scaleCode() + "' found in registry: " + scaleLocation.registryDescription());
            }
            if (item.implemented()) {
                ScaleDefinition definition = readDefinition(scaleLocation, item);
                validateDefinition(item, definition, scaleLocation);
                definitions.put(definition.scaleCode(), definition);
            }
        }

        log.info(
                "Loaded {} scale registry items and {} implemented scale definitions from {}",
                registryItems.size(),
                definitions.size(),
                scaleLocation.description()
        );
        return new LoadedScaleResources(Map.copyOf(registryItems), Map.copyOf(definitions));
    }

    private ScaleRegistryFile readRegistry(ScaleLocation scaleLocation) {
        try (InputStream inputStream = scaleLocation.openRegistry(resourceLoader)) {
            return objectMapper.readValue(inputStream, ScaleRegistryFile.class);
        } catch (IOException exception) {
            throw fail(
                    "Failed to load scale registry from " + scaleLocation.registryDescription() + ": " + exception.getMessage(),
                    exception
            );
        }
    }

    private ScaleDefinition readDefinition(ScaleLocation scaleLocation, ScaleRegistryItem item) {
        String definitionDescription = item.definitionFile();
        try {
            definitionDescription = scaleLocation.definitionDescription(item.definitionFile());
        } catch (RuntimeException exception) {
            throw fail(
                    "Failed to resolve scale definition path for scaleCode '" + item.scaleCode() + "' from "
                            + item.definitionFile() + ": " + exception.getMessage(),
                    exception
            );
        }

        try (InputStream inputStream = scaleLocation.openDefinition(resourceLoader, item.definitionFile())) {
            return objectMapper.readValue(inputStream, ScaleDefinition.class);
        } catch (IOException | RuntimeException exception) {
            throw fail(
                    "Failed to load scale definition for scaleCode '" + item.scaleCode() + "' from " + definitionDescription
                            + ": " + exception.getMessage(),
                    exception
            );
        }
    }

    private void validateRegistryFile(ScaleRegistryFile registryFile, ScaleLocation scaleLocation) {
        if (registryFile == null || registryFile.items() == null || registryFile.items().isEmpty()) {
            throw fail("Scale registry is empty or malformed: " + scaleLocation.registryDescription());
        }
    }

    private void validateRegistryItem(ScaleRegistryItem item, ScaleLocation scaleLocation) {
        if (item == null) {
            throw fail("Scale registry contains a null item: " + scaleLocation.registryDescription());
        }
        if (!StringUtils.hasText(item.scaleCode())) {
            throw fail("Scale registry contains an item without scaleCode: " + scaleLocation.registryDescription());
        }
        if (!StringUtils.hasText(item.scaleName())) {
            throw fail("Scale registry item '" + item.scaleCode() + "' is missing scaleName: " + scaleLocation.registryDescription());
        }
        if (item.implemented() && !StringUtils.hasText(item.definitionFile())) {
            throw fail("Implemented scale '" + item.scaleCode() + "' is missing definitionFile: " + scaleLocation.registryDescription());
        }
    }

    private void validateDefinition(ScaleRegistryItem item, ScaleDefinition definition, ScaleLocation scaleLocation) {
        if (definition == null) {
            throw fail("Scale definition for '" + item.scaleCode() + "' is empty: " + scaleLocation.definitionDescription(item.definitionFile()));
        }
        if (!StringUtils.hasText(definition.scaleCode())) {
            throw fail("Scale definition is missing scaleCode: " + scaleLocation.definitionDescription(item.definitionFile()));
        }
        if (!item.scaleCode().equals(definition.scaleCode())) {
            throw fail(
                    "Scale definition scaleCode mismatch. Registry='" + item.scaleCode() + "', definition='"
                            + definition.scaleCode() + "': " + scaleLocation.definitionDescription(item.definitionFile())
            );
        }
        if (definition.items() == null || definition.items().isEmpty()) {
            throw fail("Scale definition items are missing for '" + item.scaleCode() + "': "
                    + scaleLocation.definitionDescription(item.definitionFile()));
        }
        if (definition.questionCount() != definition.items().size()) {
            throw fail(
                    "Scale definition questionCount mismatch for '" + item.scaleCode() + "': expected "
                            + definition.questionCount() + ", actual " + definition.items().size()
                            + " at " + scaleLocation.definitionDescription(item.definitionFile())
            );
        }
    }

    private IllegalStateException fail(String message) {
        return fail(message, null);
    }

    private IllegalStateException fail(String message, Exception exception) {
        if (exception == null) {
            log.error(message);
            return new IllegalStateException(message);
        }
        log.error(message, exception);
        return new IllegalStateException(message, exception);
    }

    public record LoadedScaleResources(
            Map<String, ScaleRegistryItem> registryItems,
            Map<String, ScaleDefinition> definitions
    ) {
    }

    private record ScaleLocation(String configuredPath, String classpathBase, Path filesystemBase) {
        private static ScaleLocation from(String configuredPath) {
            String normalizedPath = StringUtils.hasText(configuredPath)
                    ? configuredPath.trim()
                    : ScaleProperties.DEFAULT_RESOURCE_PATH;
            if (normalizedPath.startsWith(CLASSPATH_PREFIX)) {
                return new ScaleLocation(normalizedPath, normalizeClasspathBase(normalizedPath), null);
            }
            Path basePath = Path.of(normalizedPath).toAbsolutePath().normalize();
            return new ScaleLocation(normalizedPath, null, basePath);
        }

        private static String normalizeClasspathBase(String configuredPath) {
            String path = configuredPath.trim().replace('\\', '/');
            while (path.endsWith("/")) {
                path = path.substring(0, path.length() - 1);
            }
            if (path.equals(CLASSPATH_PREFIX)) {
                return CLASSPATH_PREFIX + DEFAULT_SCALE_ROOT;
            }
            return path;
        }

        String description() {
            return classpathBase != null
                    ? "classpath resource path '" + classpathBase + "'"
                    : "filesystem resource path '" + filesystemBase + "'";
        }

        String registryDescription() {
            return classpathBase != null
                    ? classpathBase + "/" + REGISTRY_RELATIVE_PATH
                    : filesystemBase.resolve(REGISTRY_RELATIVE_PATH).toString();
        }

        String definitionDescription(String definitionFile) {
            return classpathBase != null
                    ? resolveClasspathDefinitionLocation(definitionFile)
                    : resolveFilesystemDefinitionPath(definitionFile).toString();
        }

        InputStream openRegistry(ResourceLoader resourceLoader) throws IOException {
            if (classpathBase != null) {
                return openClasspathResource(resourceLoader, classpathBase + "/" + REGISTRY_RELATIVE_PATH);
            }
            Path registryPath = filesystemBase.resolve(REGISTRY_RELATIVE_PATH).normalize();
            return openFileResource(registryPath, "scale registry");
        }

        InputStream openDefinition(ResourceLoader resourceLoader, String definitionFile) throws IOException {
            if (classpathBase != null) {
                return openClasspathResource(resourceLoader, resolveClasspathDefinitionLocation(definitionFile));
            }
            return openFileResource(resolveFilesystemDefinitionPath(definitionFile), "scale definition");
        }

        private InputStream openClasspathResource(ResourceLoader resourceLoader, String location) throws IOException {
            Resource resource = resourceLoader.getResource(location);
            if (!resource.exists()) {
                throw new IOException("resource does not exist");
            }
            return resource.getInputStream();
        }

        private InputStream openFileResource(Path path, String label) throws IOException {
            if (!Files.exists(path) || !Files.isRegularFile(path)) {
                throw new IOException(label + " file does not exist");
            }
            return Files.newInputStream(path);
        }

        private String resolveClasspathDefinitionLocation(String definitionFile) {
            if (!StringUtils.hasText(definitionFile)) {
                throw new IllegalStateException("Scale definitionFile is blank for configured path '" + configuredPath + "'");
            }
            String normalized = definitionFile.trim().replace('\\', '/');
            if (normalized.startsWith(CLASSPATH_PREFIX)) {
                normalized = normalized.substring(CLASSPATH_PREFIX.length());
            }
            normalized = trimLeadingSlashes(normalized);
            if (normalized.startsWith(DEFAULT_SCALE_ROOT + "/")) {
                normalized = normalized.substring((DEFAULT_SCALE_ROOT + "/").length());
            }
            if (!StringUtils.hasText(normalized)) {
                throw new IllegalStateException("Scale definitionFile resolved to an empty path for configured path '" + configuredPath + "'");
            }
            return classpathBase + "/" + normalized;
        }

        private Path resolveFilesystemDefinitionPath(String definitionFile) {
            if (!StringUtils.hasText(definitionFile)) {
                throw new IllegalStateException("Scale definitionFile is blank for configured path '" + configuredPath + "'");
            }
            String normalized = definitionFile.trim().replace('\\', '/');
            if (normalized.startsWith(CLASSPATH_PREFIX)) {
                normalized = normalized.substring(CLASSPATH_PREFIX.length());
            }
            normalized = trimLeadingSlashes(normalized);
            if (normalized.startsWith(DEFAULT_SCALE_ROOT + "/")) {
                normalized = normalized.substring((DEFAULT_SCALE_ROOT + "/").length());
            }
            if (!StringUtils.hasText(normalized)) {
                throw new IllegalStateException("Scale definitionFile resolved to an empty path for configured path '" + configuredPath + "'");
            }

            Path resolved = filesystemBase.resolve(normalized).toAbsolutePath().normalize();
            if (!resolved.startsWith(filesystemBase)) {
                throw new IllegalStateException(
                        "Scale definition path escapes configured filesystem resource path. configured='"
                                + filesystemBase + "', definition='" + definitionFile + "'"
                );
            }
            return resolved;
        }

        private static String trimLeadingSlashes(String value) {
            String normalized = value;
            while (normalized.startsWith("/")) {
                normalized = normalized.substring(1);
            }
            return normalized;
        }
    }
}
