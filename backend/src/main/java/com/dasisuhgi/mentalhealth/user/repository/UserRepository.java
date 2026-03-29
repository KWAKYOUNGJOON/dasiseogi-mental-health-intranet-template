package com.dasisuhgi.mentalhealth.user.repository;

import com.dasisuhgi.mentalhealth.user.entity.User;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface UserRepository extends JpaRepository<User, Long> {
    Optional<User> findByLoginId(String loginId);
}
