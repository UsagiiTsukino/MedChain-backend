-- Fix for existing bookings: Create missing appointments
-- Run this ONCE after backing up your database

-- Booking 1: booking_id=1, patient='wallet_51bad2623b19f096995a99ba3567e444', 
-- center_id=1, firstDoseDate='2025-12-10', firstDoseTime='08:00', totalDoses=1
INSERT INTO `appointments` (`booking_id`, `center_id`, `dose_number`, `appointment_date`, `appointment_time`, `status`, `created_at`, `updated_at`)
VALUES (1, 1, 1, '2025-12-10', '08:00', 'SCHEDULED', NOW(), NOW());

-- Booking 2: booking_id=2, patient='wallet_51bad2623b19f096995a99ba3567e444',
-- center_id=1, firstDoseDate='2025-12-08', firstDoseTime='08:00', totalDoses=1
INSERT INTO `appointments` (`booking_id`, `center_id`, `dose_number`, `appointment_date`, `appointment_time`, `status`, `created_at`, `updated_at`)
VALUES (2, 1, 1, '2025-12-08', '08:00', 'SCHEDULED', NOW(), NOW());

-- Booking 3: booking_id=3, patient='wallet_51bad2623b19f096995a99ba3567e444',
-- center_id=1, firstDoseDate='2025-12-30', firstDoseTime='08:00', totalDoses=1
INSERT INTO `appointments` (`booking_id`, `center_id`, `dose_number`, `appointment_date`, `appointment_time`, `status`, `created_at`, `updated_at`)
VALUES (3, 1, 1, '2025-12-30', '08:00', 'SCHEDULED', NOW(), NOW());

-- Verify the inserts
SELECT 
    a.appointment_id,
    a.booking_id,
    b.patient_id,
    a.dose_number,
    a.appointment_date,
    a.appointment_time,
    a.status,
    c.name as center_name
FROM appointments a
JOIN bookings b ON a.booking_id = b.booking_id
JOIN centers c ON a.center_id = c.center_id
ORDER BY a.booking_id, a.dose_number;
