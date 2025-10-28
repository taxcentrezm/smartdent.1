// Feather icons
feather.replace();

(function initConverter(){
  const rateIndicator = document.getElementById('rateIndicator');
  if (!rateIndicator) return; // Exit if not on this page


/* ----------------------
   Slideshow (Dashboard)
---------------------- */
(function initSlideshow(){
  const slides = Array.from(document.querySelectorAll('#slideshow .slide'));
  if(!slides.length) return;
  let idx = 0;
  slides.forEach((s, i) => s.style.opacity = i === 0 ? '1' : '0');
  function show(i){ slides.forEach((s, j) => s.style.opacity = j === i ? '1' : '0'); }
  setInterval(() => { idx = (idx + 1) % slides.length; show(idx); }, 5000);
})();

/* ----------------------
   Dropdowns (Header)
---------------------- */
(function initDropdowns(){
  document.querySelectorAll('[data-dropdown-target]').forEach(btn => {
    const id = btn.getAttribute('data-dropdown-target');
    const menu = document.getElementById(id);
    if(!menu) return;
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const visible = menu.style.display === 'block';
      document.querySelectorAll('.dropdown-hidden').forEach(d => d.style.display = 'none');
      menu.style.display = visible ? 'none' : 'block';
    });
  });
  const profileBtn = document.getElementById('profileBtn');
  const profileDropdown = document.getElementById('profileDropdown');
  if(profileBtn && profileDropdown){
    profileBtn.addEventListener('click', e => {
      e.stopPropagation();
      profileDropdown.style.display = profileDropdown.style.display === 'block' ? 'none' : 'block';
    });
  }
  document.addEventListener('click', () => {
    document.querySelectorAll('.dropdown-hidden').forEach(d => d.style.display = 'none');
  });
})();

/* ----------------------
   Charts (Dashboard + Reports)
---------------------- */
(function initCharts(){
  const revenueCtx = document.getElementById('revenueChart')?.getContext('2d');
  if(revenueCtx){
    new Chart(revenueCtx, {
      type: 'line',
      data: {
        labels: ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep'],
        datasets: [{
          label: 'Revenue',
          data: [12000,15000,14000,18000,17000,20000,21000,23000,19000],
          borderColor: '#6366F1',
          borderWidth: 3,
          tension: 0.4,
          pointRadius: 3,
          fill: false
        }]
      },
      options: { plugins:{legend:{display:false}}, scales:{y:{beginAtZero:false}}, responsive:true, maintainAspectRatio:false }
    });
  }

  const serviceCtx = document.getElementById('serviceChart')?.getContext('2d');
  if(serviceCtx){
    new Chart(serviceCtx, {
      type: 'doughnut',
      data: {
        labels: ['Fillings','Cleaning','Root Canal','Cosmetic','Ortho'],
        datasets: [{ data: [45,25,15,10,5], backgroundColor: ['#60A5FA','#34D399','#FBBF24','#F87171','#A78BFA'] }]
      },
      options: { plugins:{legend:{position:'right'}}, responsive:true, maintainAspectRatio:false }
    });
  }

  const growthCtx = document.getElementById('growthChart')?.getContext('2d');
  if(growthCtx){
    new Chart(growthCtx, {
      type: 'bar',
      data: {
        labels: ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep'],
        datasets: [{ label: 'New Patients', data: [40,55,48,60,72,65,80,90,78], backgroundColor: '#10B981' }]
      },
      options: { plugins:{legend:{display:false}}, scales:{y:{beginAtZero:true}}, responsive:true, maintainAspectRatio:false }
    });
  }
})();

/* ----------------------
   Patient Search
---------------------- */
(function initPatientSearch(){
  const patients = [
    {name:'Alice Mukuka', note:'Cleaning', date:'Oct 01', status:'Paid'},
    {name:'Brian Zulu', note:'Root Canal', date:'Sep 28', status:'Invoice'},
    {name:'Nadine Clarke', note:'Crown Fitting', date:'Sep 25', status:'Overdue'}
  ];
  const ul = document.getElementById('patientList');
  if(!ul) return;
  function render(list){
    ul.innerHTML = '';
    list.forEach(p => {
      const initials = p.name.split(' ').map(s=>s[0]).slice(0,2).join('');
      const li = document.createElement('li');
      li.className = 'flex items-center justify-between';
      li.innerHTML = `
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center font-semibold">${initials}</div>
          <div><div class="font-medium">${p.name}</div><div class="text-xs text-gray-500">${p.note} — ${p.date}</div></div>
        </div>
        <div class="text-sm ${p.status==='Paid'?'text-green-600':p.status==='Overdue'?'text-rose-600':'text-amber-600'}">${p.status}</div>
      `;
      ul.appendChild(li);
    });
  }
  render(patients);
  document.getElementById('searchBtn')?.addEventListener('click', () => {
    const q = document.getElementById('patientSearch')?.value.toLowerCase();
    render(patients.filter(p => p.name.toLowerCase().includes(q) || p.note.toLowerCase().includes(q)));
  });
})();

/* ----------------------
   Billing & Invoice Features
---------------------- */
(function initBilling(){
  const invoices = [
    {name:'Alice Mukuka', service:'Cleaning', amount:120, date:'Oct 01', status:'Paid'},
    {name:'Brian Zulu', service:'Root Canal', amount:450, date:'Sep 28', status:'Invoice'},
    {name:'Nadine Clarke', service:'Crown Fitting', amount:320, date:'Sep 25', status:'Overdue'}
  ];
  const ul = document.getElementById('invoiceList');
  if(!ul) return;

  function render(list){
    ul.innerHTML = '';
    list.forEach(inv => {
      const initials = inv.name.split(' ').map(s=>s[0]).slice(0,2).join('');
      const li = document.createElement('li');
      li.className = 'flex items-center justify-between';
      li.innerHTML = `
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-full bg-rose-100 flex items-center justify-center font-semibold">${initials}</div>
          <div><div class="font-medium">${inv.name}</div><div class="text-xs text-gray-500">${inv.service} — ${inv.date}</div></div>
        </div>
        <div class="text-right"><div class="text-sm font-semibold">$${inv.amount}</div>
        <div class="text-xs ${inv.status==='Paid'?'text-green-600':inv.status==='Overdue'?'text-rose-600':'text-amber-600'}">${inv.status}</div></div>
      `;
      ul.appendChild(li);
    });
  }

  render(invoices);

  document.getElementById('searchBtn')?.addEventListener('click', () => {
    const q = document.getElementById('searchInput')?.value.toLowerCase();
    render(invoices.filter(i => i.name.toLowerCase().includes(q) || i.service.toLowerCase().includes(q)));
  });

  document.querySelectorAll('.card button').forEach(btn => {
    btn.addEventListener('click', () => {
      const label = btn.textContent.trim();
      if(label.includes('Generate Invoice')) {
        alert('Invoice created (demo).');
      } else if(label.includes('Mark as Paid')) {
        alert('Invoice marked as paid (demo).');
      } else if(label.includes('Export')) {
        alert('Invoices exported as CSV (demo).');
      }
    });
  });
})();

/* ----------------------
   Payroll + Export + Apply Conversion
---------------------- */
(function initPayroll(){
  const employees = [
    { name:'Dr. Alice Mwansa', role:'Dentist', baseSalary:5000 },
    { name:'Dr. Brian Zulu', role:'Orthodontist', baseSalary:6200 },
    { name:'Nurse Chipo', role:'Dental Nurse', baseSalary:1200 },
    { name:'Receptionist Tinashe', role:'Admin', baseSalary:900 }
  ];

  const list = document.getElementById('payrollList');
  if(!list) return;

  function render(){
    list.innerHTML = '';
    let total = 0;
    employees.forEach(emp => {
      const tax = +(emp.baseSalary * 0.12).toFixed(2);
      const net = +(emp.baseSalary - tax).toFixed(2);
      total += emp.baseSalary;
      const div = document.createElement('div');
      div.className = 'py-3 flex items-center justify-between';
      div.innerHTML = `
        <div class="flex items-center gap-3">
          <div class="p-2 rounded-md bg-indigo-50"><i data-feather="user" class="text-indigo-600"></i></div>
          <div>
            <div class="font-medium">${emp.name}</div>
            <div class="text-xs text-gray-500">${emp.role}</div>
          </div>
        </div>
        <div class="text-right">
          <div class="text-sm">$${emp.baseSalary.toLocaleString()}</div>
          <div class="text-xs text-gray-500">Net $${net.toLocaleString()}</div>
        </div>
      `;
      list.appendChild(div);
    });
    document.getElementById('payrollTotal').textContent = `$${total.toLocaleString()}`;
    feather.replace();
  }

  render();

  document.getElementById('runPayroll')?.addEventListener('click', () => {
    alert('Payroll simulated: payments queued (demo).');
  });

  document.getElementById('exportPayroll')?.addEventListener('click', () => {
    alert('Export simulated: CSV generated (demo).');
  });

  document.getElementById('applyToPayroll')?.addEventListener('click', () => {
    const converted = document.getElementById('convertedValue')?.textContent;
    if(!converted || converted === '—') return alert('No converted amount available');
    alert(`Converted (${converted}) applied to payroll (demo).`);
  });
})();

/* ----------------------
   Currency Converter (Dashboard)
---------------------- */
(function initConverter(){
  let rates = null;
  const rateIndicator = document.getElementById('rateIndicator');
  const ratesErrorEl = document.getElementById('ratesError');

  async function fetchRates(){
    rateIndicator.textContent = 'Rates: Loading…';
    try{
      const res = await fetch('https://api.exchangerate.host/latest?base=USD');
      const data = await res.json();
      if(data && data.rates){
        rates = data.rates;
        populateSelects(Object.keys(rates));
        rateIndicator.textContent = 'Rates: Live';
        ratesErrorEl.textContent = '';
        updateConversion();
      } else throw new Error('No rates returned');
    }catch(err){
      rates = { USD:1, ZMW:24.5, EUR:0.92, GBP:0.78, ZAR:18.2 };
      populateSelects(Object.keys(rates));
      rateIndicator.textContent = 'Rates: Sample (offline)';
      ratesErrorEl.textContent = 'Could not fetch live rates — using sample rates.';
      updateConversion();
    }
  }

  function populateSelects(list){
    const from = document.getElementById('fromCurr');
    const to = document.getElementById('toCurr');
    if(from.options.length) return;
    const preferred = ['USD','EUR','GBP','ZMW','ZAR'];
    const ordered = [...new Set([...preferred, ...list])];
    ordered.slice(0,40).forEach(c => {
      const o1 = document.createElement('option'); o1.value = c; o1.textContent = c; from.appendChild(o1);
      const o2 = document.createElement('option'); o2.value = c; o2.textContent = c; to.appendChild(o2);
    });
    from.value = 'USD';
    to.value = 'ZMW';
    document.getElementById('fromCode').textContent = 'USD';
  }

  function updateConversion(){
    const amt = Number(document.getElementById('convAmount')?.value) || 0;
    const from = document.getElementById('fromCurr')?.value || 'USD';
    const to = document.getElementById('toCurr')?.value || 'ZMW';
    document.getElementById('fromCode').textContent = from;
    if(!rates){ document.getElementById('convertedValue').textContent='—'; return; }
    const rateFrom = rates[from] || 1;
    const rateTo = rates[to] || 1;
    const converted = (amt / rateFrom) * rateTo;
    document.getElementById('convertedValue').textContent = `${converted.toFixed(2)} ${to}`;
  }

  document.getElementById('convAmount')?.addEventListener('input', updateConversion);
  document.getElementById('fromCurr')?.addEventListener('change', updateConversion);
  document.getElementById('toCurr')?.addEventListener('change', updateConversion);
  document.getElementById('refreshRates')?.addEventListener('click', fetchRates);

  fetchRates();
})();

/* ----------------------
   Tab Switching (Clinical + Settings)
---------------------- */
(function initTabs(){
  const tabGroups = {
    clinical: ['charting','imaging','prescriptions'],
    settings: ['clinic','users','locale','integrations']
  };

  document.querySelectorAll('button').forEach(btn => {
    btn.addEventListener('click', e => {
      const label = btn.textContent.trim().toLowerCase();
      Object.entries(tabGroups).forEach(([group, tabs]) => {
        if(tabs.includes(label)){
          tabs.forEach(id => {
            const el = document.getElementById(id);
            if(el) el.style.display = id === label ? 'block' : 'none';
          });
          document.querySelectorAll('button').forEach(b => b.classList.remove('tab-active'));
          btn.classList.add('tab-active');
        }
      });
    });
  });
})();

/* ----------------------
   Prescription List (Clinical)
---------------------- */
(function initPrescriptions(){
  const prescriptions = [
    { name: 'Amoxicillin 500mg', dosage: '3x daily for 5 days' },
    { name: 'Ibuprofen 400mg', dosage: '2x daily after meals' }
  ];
  const ul = document.getElementById('prescriptionList');
  if(!ul) return;

  function render(){
    ul.innerHTML = '';
    prescriptions.forEach(p => {
      const li = document.createElement('li');
      li.className = 'flex justify-between items-center';
      li.innerHTML = `<div>${p.name} — <span class="text-gray-500">${p.dosage}</span></div>
                      <button onclick="removePrescription('${p.name}')" class="text-rose-600"><i data-feather="x"></i></button>`;
      ul.appendChild(li);
    });
    feather.replace();
  }

  window.removePrescription = function(name){
    const idx = prescriptions.findIndex(p => p.name === name);
    if(idx !== -1) prescriptions.splice(idx, 1);
    render();
  };

  window.addPrescription = function(){
    const med = document.getElementById('medInput')?.value.trim();
    if(!med) return;
    prescriptions.push({ name: med, dosage: '—' });
    document.getElementById('medInput').value = '';
    render();
  };

  render();
})();

})();
