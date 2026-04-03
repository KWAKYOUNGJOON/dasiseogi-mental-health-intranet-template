package com.dasisuhgi.mentalhealth.auth.dto;

import com.fasterxml.jackson.annotation.JsonAnySetter;
import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.validation.constraints.NotBlank;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Set;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
public class UpdateMyProfileRequest {
    @NotBlank(message = "이름을 입력해주세요.")
    private String name;

    private String phone;

    private String teamName;

    @JsonIgnore
    private final Map<String, Object> unknownFields = new LinkedHashMap<>();

    @JsonAnySetter
    public void captureUnknownField(String fieldName, Object value) {
        unknownFields.put(fieldName, value);
    }

    public Set<String> unknownFieldNames() {
        return unknownFields.keySet();
    }
}
