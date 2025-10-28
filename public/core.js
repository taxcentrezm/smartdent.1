// core.js
document.addEventListener('DOMContentLoaded', () => {
  feather.replace(); // Icons

  // =========================
  // Modal controls
  // =========================
  window.openModal = id => {
    const modal = document.getElementById(id);
    if (modal) modal.style.display = 'flex';
  };

  window.closeModal = id => {
    const modal = document.getElementById(id);
    if (modal) modal.style.display = 'none';
  };

  // =========================
  // Tabs controls
  // =========================
  window.showTab = id => {
    document.querySelectorAll('.tab-content').forEach(tab => tab.style.display = 'none');
    document.getElementById(id).style.display = 'block';

    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('tab-active'));
    document.querySelector(`button[data-tab="${id}"]`).classList.add('tab-active');
  };
});
