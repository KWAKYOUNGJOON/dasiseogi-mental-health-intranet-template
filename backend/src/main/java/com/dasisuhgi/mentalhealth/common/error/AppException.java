package com.dasisuhgi.mentalhealth.common.error;

import com.dasisuhgi.mentalhealth.common.api.FieldErrorItem;
import java.util.List;
import org.springframework.http.HttpStatus;

public class AppException extends RuntimeException {
    private final HttpStatus status;
    private final String errorCode;
    private final List<FieldErrorItem> fieldErrors;

    public AppException(HttpStatus status, String errorCode, String message) {
        this(status, errorCode, message, List.of());
    }

    public AppException(HttpStatus status, String errorCode, String message, List<FieldErrorItem> fieldErrors) {
        super(message);
        this.status = status;
        this.errorCode = errorCode;
        this.fieldErrors = fieldErrors;
    }

    public HttpStatus getStatus() {
        return status;
    }

    public String getErrorCode() {
        return errorCode;
    }

    public List<FieldErrorItem> getFieldErrors() {
        return fieldErrors;
    }
}
