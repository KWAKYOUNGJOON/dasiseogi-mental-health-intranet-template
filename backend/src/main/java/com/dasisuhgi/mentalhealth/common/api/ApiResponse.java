package com.dasisuhgi.mentalhealth.common.api;

import java.util.List;

public record ApiResponse<T>(
        boolean success,
        T data,
        String message,
        String errorCode,
        List<FieldErrorItem> fieldErrors
) {
    public static <T> ApiResponse<T> success(T data) {
        return new ApiResponse<>(true, data, null, null, List.of());
    }

    public static ApiResponse<Void> successMessage(String message) {
        return new ApiResponse<>(true, null, message, null, List.of());
    }

    public static ApiResponse<Void> failure(String message, String errorCode, List<FieldErrorItem> fieldErrors) {
        return new ApiResponse<>(false, null, message, errorCode, fieldErrors);
    }
}
