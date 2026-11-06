-- Focus Point — seed: seven spaces laid out along the corridor of the default plan (1400 × 800 plan units).
-- Prices in new Syrian pounds (the open space per seat; the training hall uses the hall price groups in the settings). Safe to run once on an empty rooms table.
INSERT INTO rooms (name, type, capacity, contents, price_hour, price_day, color, plan, active, sort, description) VALUES
 ('غرفة 1', 'private', 2, '{"chairs":2,"tables":1,"ac":true,"wifi":true}', 100, NULL, '#2563eb', '{"x":820,"y":40,"w":220,"h":260}', 1, 1, 'غرفة خاصة هادئة لشخصين'),
 ('غرفة 2', 'private', 3, '{"chairs":3,"tables":1,"ac":true,"wifi":true}', 100, NULL, '#2563eb', '{"x":560,"y":40,"w":220,"h":260}', 1, 2, 'غرفة خاصة لثلاثة أشخاص'),
 ('غرفة 3', 'private', 4, '{"chairs":4,"tables":1,"ac":true,"wifi":true,"whiteboard":true}', 100, NULL, '#2563eb', '{"x":300,"y":40,"w":220,"h":260}', 1, 3, 'غرفة خاصة لأربعة أشخاص مع لوح كتابة'),
 ('غرفة 4', 'private', 4, '{"chairs":4,"tables":1,"ac":true,"wifi":true,"screen":true}', 100, NULL, '#2563eb', '{"x":40,"y":40,"w":220,"h":260}', 1, 4, 'غرفة خاصة لأربعة أشخاص مع شاشة'),
 ('القاعة التدريبية', 'meeting', 16, '{"chairs":16,"tables":1,"screen":true,"whiteboard":true,"ac":true,"wifi":true}', 1000, NULL, '#7c3aed', '{"x":40,"y":500,"w":520,"h":260}', 1, 5, 'قاعة تدريبية مجهزة بشاشة وسبورة وتكييف، للدورات وورش العمل والاجتماعات'),
 ('المساحة المفتوحة', 'desk', 20, '{"chairs":20,"tables":5,"ac":true,"wifi":true,"coffee":true}', 100, NULL, '#0d9488', '{"x":600,"y":500,"w":560,"h":260}', 1, 6, 'مكاتب مشتركة في مساحة مفتوحة'),
 ('طاولة الاستقبال', 'desk', 8, '{"chairs":8,"tables":1,"ac":true,"wifi":true}', 100, NULL, '#0d9488', '{"x":1190,"y":40,"w":190,"h":260}', 1, 7, 'طاولة على شكل U بالاستقبال، 8 مقاعد');
