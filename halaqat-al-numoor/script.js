// ===== المتغيرات العامة =====
let clickCount = 0;
let clickTimer;
let selectedService = null;
let selectedDate = null;
let isSalonOpen = true;

// أوقات العمل: سنولد فتحات كل 45 دقيقة من 14:00 إلى 01:00
// نستخدم مفتاح زمني بصيغة 24 ساعة (قد يتجاوز 24 لتمثيل بعد منتصف الليل، مثلاً 25:00 = 01:00 التالي)

// تحويل مفتاح الوقت 'HH:MM' إلى دقائق (يمكن أن يكون H >= 24)
function parseTimeKey(key) {
    const parts = key.split(':').map(Number);
    return parts[0] * 60 + parts[1];
}

// تنسيق التسمية العربية من دقائق (نأخذ باقي 24 ساعة للعرض)
function formatLabelFromMinutes(totalMinutes) {
    const minsInDay = 24 * 60;
    const m = totalMinutes % minsInDay;
    const h = Math.floor(m / 60);
    const mm = m % 60;
    const mmStr = mm.toString().padStart(2, '0');

    if (h === 0) return `12:${mmStr}ليل`;
    if (h === 12) return `12:${mmStr}ظ`;
    if (h > 12 && h < 24) return `${h - 12}:${mmStr}م`;
    return `${h}:${mmStr}ص`;
}

// توليد فتحات الوقت ديناميكياً (45 دقيقة خطوة) من 14:00 إلى 25:00 (1:00 صباحاً التالي)
function generateTimeSlots() {
    const container = document.getElementById('time-slots');
    container.innerHTML = '';

    // قراءة الإعدادات إن وجدت
    const stored = localStorage.getItem('scheduler_settings');
    const settings = stored ? JSON.parse(stored) : { start: '14:00', end: '01:00', interval: 45 };

    let start = parseTimeKey(settings.start || '14:00');
    let end = parseTimeKey(settings.end || '01:00');
    const step = parseInt(settings.interval || 45, 10);

    // إذا النهاية أصغر أو تساوي البداية نعتبرها صباح اليوم التالي
    if (end <= start) end += 24 * 60;

    for (let t = start; t <= end; t += step) {
        const hour = Math.floor(t / 60);
        const minute = t % 60;
        const key = `${hour}:${minute.toString().padStart(2, '0')}`; // مثال: '14:00' أو '25:00'
        const label = formatLabelFromMinutes(t);

        const slot = document.createElement('div');
        slot.className = 'time-slot';
        slot.textContent = label;
        slot.dataset.timeKey = key;
        slot.dataset.timeLabel = label;
        slot.onclick = () => selectTime(slot, key, label);
        container.appendChild(slot);
    }
}

// ===== عند تحميل الصفحة =====
document.addEventListener('DOMContentLoaded', function() {
    generateCalendar();
    generateTimeSlots();
    checkSalonStatus();
    loadBookingsFromStorage();
    incrementVisitorCount();
    
    // النقر الثلاثي على اسم الصالون
    document.getElementById('salon-name').addEventListener('click', handleTripleClick);
});

// ===== عداد الزوار (localStorage-based) =====
function incrementVisitorCount() {
    try {
        const now = new Date();
        const weekStart = getStartOfWeekMillis(now);

        const storedWeekStart = parseInt(localStorage.getItem('site_week_start') || '0', 10);
        if (storedWeekStart !== weekStart) {
            // new week -> reset weekly counter and update stored week
            localStorage.setItem('site_week_start', String(weekStart));
            localStorage.setItem('site_week_visitors_count', '0');
        }

        const hasVisitedTotal = localStorage.getItem('site_has_visited') === 'true';
        const hasVisitedWeek = localStorage.getItem('site_has_visited_week') === String(weekStart);

        if (!hasVisitedTotal) {
            const cur = parseInt(localStorage.getItem('site_visitors_count') || '0', 10);
            localStorage.setItem('site_visitors_count', String(cur + 1));
            localStorage.setItem('site_has_visited', 'true');
        }

        if (!hasVisitedWeek) {
            const curW = parseInt(localStorage.getItem('site_week_visitors_count') || '0', 10);
            localStorage.setItem('site_week_visitors_count', String(curW + 1));
            localStorage.setItem('site_has_visited_week', String(weekStart));
        }

        const total = parseInt(localStorage.getItem('site_visitors_count') || '0', 10);
        const week = parseInt(localStorage.getItem('site_week_visitors_count') || '0', 10);
        const el = document.getElementById('visitor-num');
        if (el) el.textContent = total.toLocaleString();
        const elW = document.getElementById('visitor-week-num');
        if (elW) elW.textContent = week.toLocaleString();
    } catch (e) {
        console.warn('visitor counter unavailable', e);
    }
}

function getStartOfWeekMillis(d) {
    const date = new Date(d);
    const day = date.getDay(); // 0 = Sunday
    date.setHours(0,0,0,0);
    date.setDate(date.getDate() - day);
    return date.getTime();
}

function getVisitorCount() {
    return parseInt(localStorage.getItem('site_visitors_count') || '0', 10);
}

function getWeekVisitorCount() {
    return parseInt(localStorage.getItem('site_week_visitors_count') || '0', 10);
}

function getVisitorCount() {
    return parseInt(localStorage.getItem('site_visitors_count') || '0', 10);
}

// ===== النقر الثلاثي للأدمن =====
function handleTripleClick() {
    clickCount++;
    
    if (clickCount === 1) {
        clickTimer = setTimeout(() => {
            clickCount = 0;
        }, 500);
    }
    
    if (clickCount === 3) {
        clearTimeout(clickTimer);
        clickCount = 0;
        showAdminModal();
    }
}

function showAdminModal() {
    document.getElementById('admin-modal').style.display = 'flex';
}

function closeAdmin() {
    document.getElementById('admin-modal').style.display = 'none';
    document.getElementById('admin-password').value = '';
}

function checkPassword() {
    const password = document.getElementById('admin-password').value;
    if (password === '11111118') {
        window.location.href = 'admin.html';
    } else {
        alert('رمز المرور غير صحيح!');
    }
}

// ===== إنشاء التقويم =====
function generateCalendar() {
    const calendar = document.getElementById('calendar');
    const days = ['أحد', 'اثنين', 'ثلاثاء', 'أربعاء', 'خميس', 'جمعة', 'سبت'];
    // الحصول على إعدادات الجدول (من التخزين أو الافتراضي)
    const stored = localStorage.getItem('scheduler_settings');
    const settings = stored ? JSON.parse(stored) : { start: '14:00', end: '01:00', interval: 45, openDays: { 'أحد': true, 'اثنين': true, 'ثلاثاء': true, 'أربعاء': true, 'خميس': true, 'جمعة': true, 'سبت': true } };

    days.forEach((day) => {
        const dayDiv = document.createElement('div');
        dayDiv.className = 'day';
        dayDiv.textContent = day;

        // إذا اليوم مغلق حسب الإعدادات
        if (!settings.openDays || !settings.openDays[day]) {
            dayDiv.classList.add('disabled');
            dayDiv.onclick = null;
        } else {
            dayDiv.onclick = () => selectDate(dayDiv, day);
        }

        calendar.appendChild(dayDiv);
    });
}

// (تم استبدال توليد الفتحات بدالة ديناميكية أعلاه)

// ===== تحديث حالة الأوقات المحجوزة =====
function rangesIntersect(aStart, aEnd, bStart, bEnd) {
    return aStart < bEnd && bStart < aEnd;
}

function updateBookedSlots() {
    const slots = document.querySelectorAll('.time-slot');
    const bookings = getBookings();

    slots.forEach(slot => {
        const slotKey = slot.dataset.timeKey; // '14:00' أو '25:00'
        const slotStart = parseTimeKey(slotKey);

        // افتراض مدة الفتحة الأساسية 45 دقيقة
        const slotEnd = slotStart + 45;

        // هل هناك حجز يتقاطع مع هذه الفتحة لنفس اليوم؟
        const isBooked = bookings.some(b => {
            if (b.date !== selectedDate) return false;

            // حجز قد يكون مخزن مع timeKey (إذا تم حفظه من هذه النسخة)
            const bStart = parseTimeKey(b.timeKey || b.time);
            const bDuration = b.duration || 45;
            const bEnd = bStart + bDuration;

            return rangesIntersect(slotStart, slotEnd, bStart, bEnd);
        });

        // تحقق من عدم توفر الحلاق في هذا اليوم/الوقت
        const barberUnavailableRaw = localStorage.getItem('barber_unavailable');
        const barberUnavailable = barberUnavailableRaw ? JSON.parse(barberUnavailableRaw) : {};
        const dayUnavailable = barberUnavailable[selectedDate] || [];
        const isUnavailable = dayUnavailable.includes(slotKey);

        if (isBooked || isUnavailable) {
            slot.classList.add(isUnavailable ? 'unavailable' : 'booked');
            slot.onclick = null;
        } else {
            slot.classList.remove('booked');
            slot.classList.remove('unavailable');
            slot.onclick = () => selectTime(slot, slotKey, slot.dataset.timeLabel);
        }
    });
}

// ===== اختيار الخدمة =====
function selectService(service, price, duration) {
    selectedService = { service, price, duration };
    document.getElementById('booking-section').style.display = 'block';
    
    // تمييز البطاقة المختارة
    document.querySelectorAll('.service-card').forEach(card => {
        card.style.borderColor = '#333';
    });
    event.currentTarget.style.borderColor = '#d4af37';
    
    document.getElementById('booking-section').scrollIntoView({ behavior: 'smooth' });
}

// ===== اختيار التاريخ =====
function selectDate(element, day) {
    document.querySelectorAll('.day').forEach(d => d.classList.remove('selected'));
    element.classList.add('selected');
    selectedDate = day;
    
    // تحديث الأوقات المحجوزة لهذا اليوم
    updateBookedSlots();
}

// ===== اختيار الوقت =====
let selectedTimeKey = null;
let selectedTimeLabel = null;

function selectTime(element, timeKey, timeLabel) {
    if (element.classList.contains('booked')) {
        alert('هذا الوقت محجوز مسبقاً، يرجى اختيار وقت آخر');
        return;
    }

    document.querySelectorAll('.time-slot').forEach(t => {
        if (!t.classList.contains('booked')) {
            t.classList.remove('selected');
        }
    });

    element.classList.add('selected');
    selectedTimeKey = timeKey;
    selectedTimeLabel = timeLabel;

    document.getElementById('customer-form').style.display = 'block';
    document.getElementById('customer-form').scrollIntoView({ behavior: 'smooth' });
}

// ===== تأكيد الحجز =====
function confirmBooking() {
    const name = document.getElementById('customer-name').value.trim();
    const phone = document.getElementById('customer-phone').value.trim();
    const message = document.getElementById('customer-message').value.trim();
    
    if (!name || !phone) {
        alert('الرجاء إدخال الاسم ورقم الجوال');
        return;
    }
    
    if (!selectedDate || !selectedTimeKey) {
        alert('الرجاء اختيار اليوم والوقت');
        return;
    }
    
    // التحقق من عدم وجود حجز يتقاطع مع الوقت المختار
    const bookings = getBookings();
    const bookingStart = parseTimeKey(selectedTimeKey);
    const bookingDuration = selectedService.duration || 45;
    const bookingEnd = bookingStart + bookingDuration;

    const conflict = bookings.some(b => {
        if (b.date !== selectedDate) return false;
        const bStart = parseTimeKey(b.timeKey || b.time);
        const bDuration = b.duration || 45;
        const bEnd = bStart + bDuration;
        return rangesIntersect(bookingStart, bookingEnd, bStart, bEnd);
    });

    if (conflict) {
        alert('عذراً، هذا الوقت يتقاطع مع حجز موجود، يرجى اختيار وقت آخر');
        updateBookedSlots();
        return;
    }
    
    // إنشاء الحجز
    const booking = {
        id: Date.now(),
        name,
        phone,
        message: message || '',
        service: selectedService.service,
        serviceName: getServiceName(selectedService.service),
        price: selectedService.price,
        date: selectedDate,
        time: selectedTimeLabel,
        timeKey: selectedTimeKey,
        duration: selectedService.duration || 45,
        timestamp: new Date().toISOString(),
        status: 'مؤكد'
    };
    
    // حفظ الحجز
    bookings.push(booking);
    saveBookings(bookings);
    
    // عرض رسالة النجاح
    showSuccessMessage(booking);
    
    // تحديث العرض
    updateBookedSlots();
    resetForm();
}

// ===== دوال المساعدة =====
function getServiceName(serviceCode) {
    const names = {
        'kids': 'حلاقة أطفال',
        'combo': 'شعر + لحية',
        'dye': 'صبغ الشعر',
        'hair-dryer': 'شسوار',
        'facial': 'جلسة تنظيف بشرة'
    };
    return names[serviceCode] || serviceCode;
}

function showSuccessMessage(booking) {
    const main = document.querySelector('main');
    const msgDiv = document.createElement('div');
    msgDiv.className = 'success-message';
    
    let messageContent = `
        <h3>✅ تم الحجز بنجاح!</h3>
        <div class="booking-details">
            <div class="detail-row">
                <span class="label">الاسم:</span>
                <span class="value">${booking.name}</span>
            </div>
            <div class="detail-row">
                <span class="label">رقم الجوال:</span>
                <span class="value">${booking.phone}</span>
            </div>
            <div class="detail-row">
                <span class="label">الخدمة:</span>
                <span class="value">${booking.serviceName}</span>
            </div>
            <div class="detail-row">
                <span class="label">اليوم:</span>
                <span class="value">${booking.date}</span>
            </div>
            <div class="detail-row">
                <span class="label">الوقت:</span>
                <span class="value">${booking.time}</span>
            </div>
            <div class="detail-row">
                <span class="label">السعر:</span>
                <span class="value price">${booking.price.toLocaleString()} د.ع</span>
            </div>
    `;
    
    if (booking.message) {
        messageContent += `
            <div class="detail-row message-row">
                <span class="label">الملاحظات:</span>
                <span class="value message-text">${booking.message}</span>
            </div>
        `;
    }
    
    messageContent += `
        </div>
        <p class="confirmation-text">سيتم التواصل معك قريباً للتأكيد</p>
    `;
    
    msgDiv.innerHTML = messageContent;
    main.insertBefore(msgDiv, main.firstChild);
    
    setTimeout(() => {
        msgDiv.remove();
    }, 6000);
}

function resetForm() {
    document.getElementById('customer-name').value = '';
    document.getElementById('customer-phone').value = '';
    document.getElementById('customer-message').value = '';
    document.querySelectorAll('.selected').forEach(el => {
        if (!el.classList.contains('booked')) {
            el.classList.remove('selected');
        }
    });
    selectedTimeKey = null;
    selectedTimeLabel = null;
    document.getElementById('customer-form').style.display = 'none';
}

// ===== إدارة الحجوزات في التخزين المحلي =====
function getBookings() {
    const stored = localStorage.getItem('halaqat_bookings');
    return stored ? JSON.parse(stored) : [];
}

function saveBookings(bookings) {
    localStorage.setItem('halaqat_bookings', JSON.stringify(bookings));
}

function loadBookingsFromStorage() {
    // تحميل الحجوزات عند بدء التطبيق
    const bookings = getBookings();
    // حاول تحويل الحجوزات القديمة إلى المفتاح الجديد timeKey إن أمكن
    let changed = false;
    bookings.forEach(b => {
        if (!b.timeKey && b.time) {
            const tk = convertLabelToTimeKey(b.time);
            if (tk) {
                b.timeKey = tk;
                changed = true;
            }
        }
    });
    if (changed) saveBookings(bookings);
    console.log('تم تحميل', bookings.length, 'حجز');
}

function convertLabelToTimeKey(label) {
    if (!label) return null;
    // توقع الشكل: H:MM<suffix> حيث suffix واحد من: ص، م، ظ، ليل
    const match = label.match(/(\d{1,2}):(\d{2})\s*(ص|م|ظ|ليل)?/);
    if (!match) return null;
    let h = parseInt(match[1], 10);
    const mm = match[2];
    const suf = match[3] || '';

    if (suf === 'ص') {
        if (h === 12) h = 0;
    } else if (suf === 'ظ') {
        h = 12;
    } else if (suf === 'م') {
        if (h < 12) h += 12;
    } else if (suf === 'ليل') {
        // نعتبرها بعد منتصف الليل (إن كان 12 -> 0, وإلا نضيف 12)
        if (h === 12) h = 0; else if (h < 12) h += 12;
    }

    return `${h}:${mm}`;
}

// ===== التحقق من حالة المحل =====
function checkSalonStatus() {
    const saved = localStorage.getItem('salonStatus');
    const isOpen = saved !== 'false';
    updateSalonStatus(isOpen);
}

function updateSalonStatus(isOpen) {
    isSalonOpen = isOpen;
    const dot = document.getElementById('status-dot');
    const text = document.getElementById('status-text');
    
    if (isOpen) {
        dot.className = 'dot open';
        text.textContent = 'مفتوح الآن';
        text.style.color = '#4caf50';
    } else {
        dot.className = 'dot closed';
        text.textContent = 'مغلق حالياً';
        text.style.color = '#f44336';
        
        document.querySelector('main').innerHTML = `
            <div class="closed-message">
                <h2>المحل مغلق حالياً</h2>
                <p>نراكم غداً إن شاء الله</p>
                <p style="margin-top: 20px; color: #666;">مواعيد العمل: 9 ص - 9 م</p>
                <p style="color: #666;">الجمعة: 2 م - 9 م</p>
            </div>
        `;
    }
}