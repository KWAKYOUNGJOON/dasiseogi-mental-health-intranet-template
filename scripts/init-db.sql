CREATE DATABASE IF NOT EXISTS mental_health_local CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;
CREATE USER IF NOT EXISTS 'mental_user'@'localhost' IDENTIFIED BY 'mental_pass';
GRANT ALL PRIVILEGES ON mental_health_local.* TO 'mental_user'@'localhost';
FLUSH PRIVILEGES;
