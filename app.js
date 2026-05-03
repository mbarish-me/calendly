const RAZORPAY_KEY = 'rzp_test_SiZOGua58pAWDo';
const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxSNIW4zRo4mkVW4hpIJNs948K7FPqowKfsr9WDYjCBMFHt6nyP8sN1ri2Bu9pYUqKb/exec';

// Initialize the map
const map = L.map('map').setView([20, 0], 2);

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 18,
    attribution: '© OpenStreetMap contributors'
}).addTo(map);

// State
let currentPartner = null;
let selectedSlot = null;

const partners = [
    {
        id: "uk-partner",
        name: "Shylaja Lowsarwar",
        country: "United Kingdom",
        coords: [54.5, -3.5]
    },
    {
        id: "india-partner",
        name: "Ambarish Lowsarwar",
        country: "India",
        coords: [20.5937, 78.9629]
    }
];

// Add markers to the map
partners.forEach(partner => {
    const marker = L.marker(partner.coords).addTo(map);
    marker.bindPopup(`
        <div class="partner-popup">
            <h3>${partner.name}</h3>
            <p><strong>${partner.country}</strong></p>
            <button class="book-btn" onclick="initiateBooking('${partner.id}')">Book Consultation</button>
        </div>
    `);
});

// Step 1: Open slot picker
function initiateBooking(partnerId) {
    currentPartner = partners.find(p => p.id === partnerId);
    selectedSlot = null;

    document.getElementById('slot-partner-name').innerText = currentPartner.name;
    document.getElementById('client-name').value = '';
    document.getElementById('client-email').value = '';
    document.getElementById('client-notes').value = '';
    document.getElementById('proceed-btn').disabled = true;
    document.getElementById('slots-container').innerHTML = '<p class="slots-loading">Loading available slots...</p>';
    document.getElementById('slot-modal').style.display = 'flex';

    fetchSlots(currentPartner.name);
}

// Generic JSONP helper
function jsonpRequest(url, onSuccess, onError) {
    const callbackName = 'cb_' + Math.random().toString(36).substr(2, 9);
    const script = document.createElement('script');

    const timeout = setTimeout(() => {
        cleanup();
        onError && onError(new Error('Request timed out'));
    }, 10000);

    function cleanup() {
        clearTimeout(timeout);
        delete window[callbackName];
        if (script.parentNode) document.body.removeChild(script);
    }

    window[callbackName] = function(data) {
        cleanup();
        onSuccess(data);
    };

    script.onerror = function() {
        cleanup();
        onError && onError(new Error('Script load failed'));
    };

    script.src = `${url}&callback=${callbackName}`;
    document.body.appendChild(script);
}

// Fetch available slots via JSONP
function fetchSlots(lawyerName) {
    jsonpRequest(
        `${APPS_SCRIPT_URL}?lawyer=${encodeURIComponent(lawyerName)}`,
        function(slots) { renderSlots(slots); },
        function() { document.getElementById('slots-container').innerHTML = '<p class="slots-error">Failed to load slots. Please try again.</p>'; }
    );
}

// Render slots grouped by date
function renderSlots(slots) {
    const container = document.getElementById('slots-container');

    if (!slots.length) {
        container.innerHTML = '<p class="slots-empty">No available slots at the moment. Please check back later.</p>';
        return;
    }

    // Group by date
    const grouped = slots.reduce((acc, slot) => {
        if (!acc[slot.date]) acc[slot.date] = [];
        acc[slot.date].push(slot);
        return acc;
    }, {});

    const html = Object.keys(grouped).sort().map(date => {
        const label = new Date(date + 'T00:00:00').toLocaleDateString('en-GB', {
            weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
        });
        const buttons = grouped[date].map(slot => `
            <button class="slot-btn" onclick="selectSlot(this, ${JSON.stringify(slot).split('"').join('&quot;')})">
                ${slot.startTime} – ${slot.endTime}
            </button>
        `).join('');
        return `<div class="slot-date-group"><h4>${label}</h4><div class="slot-times">${buttons}</div></div>`;
    }).join('');

    container.innerHTML = html;
}

// Step 2: User selects a slot
function selectSlot(btn, slot) {
    document.querySelectorAll('.slot-btn').forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');
    selectedSlot = slot;
    document.getElementById('proceed-btn').disabled = false;
}

// Step 3: Validate and move to payment
function proceedToPayment() {
    const name = document.getElementById('client-name').value.trim();
    const email = document.getElementById('client-email').value.trim();

    if (!selectedSlot) {
        alert('Please select a time slot.');
        return;
    }
    if (!name || !email) {
        alert('Please enter your name and email.');
        return;
    }

    document.getElementById('slot-modal').style.display = 'none';
    document.getElementById('selected-partner-name').innerText = currentPartner.name;
    document.getElementById('selected-slot-info').innerText =
        `${new Date(selectedSlot.date + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })} at ${selectedSlot.startTime}`;
    document.getElementById('payment-modal').style.display = 'flex';
}

// Go back to slot picker from payment modal
function backToSlots() {
    document.getElementById('payment-modal').style.display = 'none';
    document.getElementById('slot-modal').style.display = 'flex';
}

// Step 4: Pay with Razorpay
function completePayment() {
    const name = document.getElementById('client-name').value.trim();
    const email = document.getElementById('client-email').value.trim();
    const notes = document.getElementById('client-notes').value.trim();

    const btn = document.getElementById('pay-button');
    btn.disabled = true;

    const options = {
        key: RAZORPAY_KEY,
        amount: 5000,
        currency: 'INR',
        name: 'Ambarish Global Network',
        description: `Consultation with ${currentPartner.name}`,
        theme: { color: '#006bff' },
        prefill: { name, email },
        handler: function(response) {
            document.getElementById('payment-modal').style.display = 'none';
            bookSlot(name, email, notes, response.razorpay_payment_id);
        },
        modal: {
            ondismiss: function() {
                btn.disabled = false;
            }
        }
    };

    const rzp = new Razorpay(options);
    rzp.on('payment.failed', function(response) {
        alert('Payment failed: ' + response.error.description);
        btn.disabled = false;
    });
    rzp.open();
}

// Step 5: Save booking to Google Sheet via JSONP
function bookSlot(name, email, notes, paymentId) {
    const subHeader = document.getElementById('sub-header');
    subHeader.innerText = 'Confirming your booking...';
    subHeader.style.color = '#666';

    const params = new URLSearchParams({
        action: 'book',
        slotId: selectedSlot.slotId,
        clientName: name,
        clientEmail: email,
        paymentId: paymentId,
        notes: notes
    });

    const slot = selectedSlot;
    currentPartner = null;
    selectedSlot = null;

    jsonpRequest(
        `${APPS_SCRIPT_URL}?${params}`,
        function(result) {
            if (result.status === 'success') {
                subHeader.innerText = `Booking confirmed! A confirmation has been sent to ${email}.`;
                subHeader.style.color = '#28a745';
            } else {
                subHeader.innerText = 'Booking failed: ' + (result.message || 'Unknown error. Please contact support with payment ID: ' + paymentId);
                subHeader.style.color = '#dc3545';
            }
        },
        function() {
            subHeader.innerText = 'Could not confirm booking. Please contact support with payment ID: ' + paymentId;
            subHeader.style.color = '#dc3545';
        }
    );
}

function closeSlotModal() {
    document.getElementById('slot-modal').style.display = 'none';
    currentPartner = null;
    selectedSlot = null;
}
