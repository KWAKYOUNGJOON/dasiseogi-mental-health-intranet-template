package com.dasisuhgi.mentalhealth.common.web;

import jakarta.servlet.http.HttpServletRequest;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.context.request.RequestAttributes;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

@Service
public class RequestMetadataService {
    private boolean trustProxyHeaders;

    public RequestMetadataService(@Value("${app.security.trust-proxy-headers:false}") boolean trustProxyHeaders) {
        this.trustProxyHeaders = trustProxyHeaders;
    }

    public String getClientIpAddress() {
        RequestAttributes attributes = RequestContextHolder.getRequestAttributes();
        if (!(attributes instanceof ServletRequestAttributes servletAttributes)) {
            return null;
        }
        HttpServletRequest request = servletAttributes.getRequest();
        String remoteAddr = blankToNull(request.getRemoteAddr());
        if (!trustProxyHeaders) {
            return remoteAddr;
        }
        String forwardedFor = firstHeaderValue(request, "X-Forwarded-For");
        if (forwardedFor != null) {
            return forwardedFor;
        }
        String realIp = firstHeaderValue(request, "X-Real-IP");
        return realIp != null ? realIp : remoteAddr;
    }

    private String firstHeaderValue(HttpServletRequest request, String headerName) {
        String rawValue = request.getHeader(headerName);
        if (rawValue == null || rawValue.isBlank()) {
            return null;
        }
        String[] tokens = rawValue.split(",");
        for (String token : tokens) {
            String candidate = blankToNull(token);
            if (candidate != null && !"unknown".equalsIgnoreCase(candidate)) {
                return candidate;
            }
        }
        return null;
    }

    private String blankToNull(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }
}
