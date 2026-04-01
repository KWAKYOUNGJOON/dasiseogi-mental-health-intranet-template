package com.dasisuhgi.mentalhealth.common.error;

import com.dasisuhgi.mentalhealth.common.api.ApiResponse;
import com.dasisuhgi.mentalhealth.common.api.FieldErrorItem;
import java.util.List;
import java.util.Objects;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.FieldError;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

@RestControllerAdvice
public class GlobalExceptionHandler {
    private static final Logger log = LoggerFactory.getLogger(GlobalExceptionHandler.class);

    @ExceptionHandler(AppException.class)
    public ResponseEntity<ApiResponse<Void>> handleAppException(AppException exception) {
        return ResponseEntity.status(Objects.requireNonNull(exception.getStatus(), "exception status must not be null"))
                .body(ApiResponse.failure(exception.getMessage(), exception.getErrorCode(), exception.getFieldErrors()));
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ApiResponse<Void>> handleValidationException(MethodArgumentNotValidException exception) {
        List<FieldErrorItem> fieldErrors = exception.getBindingResult()
                .getFieldErrors()
                .stream()
                .map(this::mapFieldError)
                .toList();

        return ResponseEntity.badRequest()
                .body(ApiResponse.failure("입력값을 다시 확인해주세요.", "VALIDATION_ERROR", fieldErrors));
    }

    @ExceptionHandler(HttpMessageNotReadableException.class)
    public ResponseEntity<ApiResponse<Void>> handleUnreadableMessage(HttpMessageNotReadableException exception) {
        return ResponseEntity.badRequest()
                .body(ApiResponse.failure("문항 응답 구조가 올바르지 않습니다.", "ANSWER_STRUCTURE_INVALID", List.of()));
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<ApiResponse<Void>> handleUnexpectedException(Exception exception) {
        log.error("Unhandled server exception", exception);
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(ApiResponse.failure("서버 내부 오류가 발생했습니다.", "INTERNAL_SERVER_ERROR", List.of()));
    }

    private FieldErrorItem mapFieldError(FieldError fieldError) {
        String reason = fieldError.getDefaultMessage() == null ? "유효하지 않은 값입니다." : fieldError.getDefaultMessage();
        return new FieldErrorItem(fieldError.getField(), reason);
    }
}
