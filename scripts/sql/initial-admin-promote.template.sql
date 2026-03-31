-- Initial production admin promotion template
-- Usage:
-- 1. Copy this file to a local working file before editing.
-- 2. Replace LOGIN_ID_PLACEHOLDER and PROMOTION_NOTE_PLACEHOLDER only in the copied file.
-- 3. Do not commit the edited file with real values.
-- 4. Run only after a signup request has created users.status='PENDING'
--    and user_approval_requests.request_status='PENDING'.

START TRANSACTION;

SET @target_login_id = 'LOGIN_ID_PLACEHOLDER';
SET @promotion_note = 'PROMOTION_NOTE_PLACEHOLDER';

-- Pre-check: confirm the target user and latest approval requests before updating.
SELECT id, login_id, role, status, approved_at, approved_by_id
FROM users
WHERE login_id = @target_login_id;

SELECT id, user_id, requested_login_id, request_status, requested_at, processed_at, processed_by
FROM user_approval_requests
WHERE requested_login_id = @target_login_id
ORDER BY requested_at DESC, id DESC;

UPDATE users
SET role = 'ADMIN',
    status = 'ACTIVE',
    approved_at = NOW(),
    approved_by_id = NULL,
    rejected_at = NULL,
    rejected_by_id = NULL,
    rejection_reason = NULL,
    updated_at = NOW()
WHERE login_id = @target_login_id
  AND status = 'PENDING';

SELECT ROW_COUNT() AS updated_user_rows;

UPDATE user_approval_requests request_row
JOIN (
    SELECT selected_request.latest_id
    FROM (
        SELECT latest.id AS latest_id
        FROM user_approval_requests latest
        JOIN users target_user
          ON target_user.id = latest.user_id
        WHERE target_user.login_id = @target_login_id
          AND latest.request_status = 'PENDING'
        ORDER BY latest.requested_at DESC, latest.id DESC
        LIMIT 1
    ) selected_request
) pending_request
  ON pending_request.latest_id = request_row.id
SET request_row.request_status = 'APPROVED',
    request_row.processed_at = NOW(),
    request_row.processed_by = NULL,
    request_row.process_note = @promotion_note,
    request_row.updated_at = NOW();

SELECT ROW_COUNT() AS updated_request_rows;

-- Post-check: confirm the target user and approval request state after updating.
SELECT id, login_id, role, status, approved_at, approved_by_id
FROM users
WHERE login_id = @target_login_id;

SELECT id, user_id, requested_login_id, request_status, processed_at, processed_by, process_note
FROM user_approval_requests
WHERE requested_login_id = @target_login_id
ORDER BY requested_at DESC, id DESC;

COMMIT;
