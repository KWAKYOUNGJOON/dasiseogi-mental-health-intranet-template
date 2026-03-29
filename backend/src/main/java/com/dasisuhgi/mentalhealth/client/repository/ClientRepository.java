package com.dasisuhgi.mentalhealth.client.repository;

import com.dasisuhgi.mentalhealth.client.entity.Client;
import com.dasisuhgi.mentalhealth.client.entity.ClientStatus;
import java.time.LocalDate;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ClientRepository extends JpaRepository<Client, Long> {
    List<Client> findAllByStatusNotOrderByCreatedAtDesc(ClientStatus status);

    List<Client> findAllByNameAndBirthDate(String name, LocalDate birthDate);
}
