SELECT a.id, a.status, sc.score, sc.max_score
FROM applications a
LEFT JOIN submissions s ON s.application_id = a.id
LEFT JOIN scores sc ON sc.submission_id = s.id;
