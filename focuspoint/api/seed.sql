-- Focus Point — seed: six rooms laid out along the corridor of the default plan (1200 × 800 plan units).
-- Prices in Syrian pounds. Safe to run once on an empty rooms table.
INSERT INTO rooms (name, type, capacity, contents, price_hour, price_day, color, plan, active, sort, description) VALUES
 ('غرفة 1', 'private', 2, '{"chairs":2,"tables":1,"ac":true,"wifi":true}', 15000, 100000, '#7b1e2e', '{"x":40,"y":40,"w":220,"h":260}', 1, 1, 'غرفة خاصة هادئة لشخصين'),
 ('غرفة 2', 'private', 3, '{"chairs":3,"tables":1,"ac":true,"wifi":true}', 15000, 100000, '#7b1e2e', '{"x":300,"y":40,"w":220,"h":260}', 1, 2, 'غرفة خاصة لثلاثة أشخاص'),
 ('غرفة 3', 'private', 4, '{"chairs":4,"tables":1,"ac":true,"wifi":true,"whiteboard":true}', 15000, 100000, '#7b1e2e', '{"x":560,"y":40,"w":220,"h":260}', 1, 3, 'غرفة خاصة لأربعة أشخاص مع لوح كتابة'),
 ('غرفة 4', 'private', 4, '{"chairs":4,"tables":1,"ac":true,"wifi":true,"screen":true}', 15000, 100000, '#7b1e2e', '{"x":820,"y":40,"w":220,"h":260}', 1, 4, 'غرفة خاصة لأربعة أشخاص مع شاشة'),
 ('قاعة الاجتماعات', 'meeting', 10, '{"chairs":10,"tables":1,"screen":true,"whiteboard":true,"ac":true,"wifi":true}', 40000, 250000, '#402127', '{"x":40,"y":500,"w":520,"h":260}', 1, 5, 'قاعة اجتماعات لعشرة أشخاص مع شاشة ولوح كتابة'),
 ('المساحة المفتوحة', 'desk', 8, '{"chairs":8,"tables":4,"ac":true,"wifi":true,"coffee":true}', 8000, 50000, '#a58d73', '{"x":600,"y":500,"w":560,"h":260}', 1, 6, 'مكاتب مشتركة في مساحة مفتوحة');
