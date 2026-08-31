(function () {
  'use strict';

  const MONTH_NAMES = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ];

  const DAY_NAMES = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];

  let currentDate = new Date();
  let selectedInput = null;
  let dropdown = null;

  function pad(num) {
    return String(num).padStart(2, '0');
  }

  function formatDate(date) {
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  }

  function toDateString(str) {
    const parts = str.split('-');
    if (parts.length !== 3) return null;
    const d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
    if (isNaN(d.getTime())) return null;
    return d;
  }

  function renderCalendar() {
    if (!dropdown) return;

    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    const today = new Date();
    const todayStr = formatDate(today);

    const firstDay = new Date(year, month, 1);
    const firstDayNum = firstDay.getDay();
    const startDay = (firstDayNum + 6) % 7;
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const prevMonthDays = new Date(year, month, 0).getDate();

    const selectedValue = selectedInput ? selectedInput.value : '';

    let html = '';

    for (let i = 0; i < 7; i++) {
      html += `<div class="calendar-day-name">${DAY_NAMES[i]}</div>`;
    }

    for (let i = startDay; i > 0; i--) {
      const day = prevMonthDays - i + 1;
      html += `<div class="calendar-day other-month">${day}</div>`;
    }

    for (let d = 1; d <= daysInMonth; d++) {
      const dayStr = `${year}-${pad(month + 1)}-${pad(d)}`;
      let classes = 'calendar-day';
      if (dayStr === todayStr) classes += ' today';
      if (dayStr === selectedValue) classes += ' selected';

      html += `<div class="${classes}" data-date="${dayStr}">${d}</div>`;
    }

    const totalCells = startDay + daysInMonth;
    const remaining = (7 - (totalCells % 7)) % 7;
    for (let i = 1; i <= remaining; i++) {
      html += `<div class="calendar-day other-month">${i}</div>`;
    }

    dropdown.innerHTML = `
      <div class="calendar-header">
        <button type="button" class="calendar-nav-btn" data-action="prev">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15.5 19 8.5 12 15.5 5"/></svg>
        </button>
        <span class="calendar-title">${MONTH_NAMES[month]} ${year}</span>
        <button type="button" class="calendar-nav-btn" data-action="next">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="8.5 5 15.5 12 8.5 19"/></svg>
        </button>
      </div>
      <div class="calendar-grid">${html}</div>
      <div class="calendar-footer">
        <button type="button" class="btn-clear-date" data-action="clear">LIMPIAR</button>
      </div>
    `;
  }

  function showCalendar(input) {
    selectedInput = input;

    const val = input.value.trim();
    if (val) {
      const parsed = toDateString(val);
      if (parsed) {
        currentDate = parsed;
      } else {
        currentDate = new Date();
      }
    } else {
      currentDate = new Date();
    }

    renderCalendar();

    const rect = input.getBoundingClientRect();

    const dropdownWidth = 320;
    const spaceRight = window.innerWidth - rect.right;
    const left = spaceRight < dropdownWidth ? rect.right - dropdownWidth : rect.left;

    dropdown.style.top = (rect.bottom + 8) + 'px';
    dropdown.style.left = left + 'px';
    dropdown.classList.add('show');

    if (dropdown._handleClick) {
      document.removeEventListener('click', dropdown._handleClick);
    }

    dropdown._handleClick = function (e) {
      if (e.target.closest('.calendar-day')) {
        const day = e.target.closest('.calendar-day');
        if (day.classList.contains('other-month') || day.classList.contains('disabled')) return;

        input.value = day.dataset.date;
        dropdown.classList.remove('show');
        selectedInput = null;
        input.dispatchEvent(new Event('change', { bubbles: true }));
        return;
      }

      const navBtn = e.target.closest('.calendar-nav-btn');
      if (navBtn) {
        const action = navBtn.dataset.action;
        if (action === 'prev') {
          currentDate.setMonth(currentDate.getMonth() - 1);
        } else if (action === 'next') {
          currentDate.setMonth(currentDate.getMonth() + 1);
        }
        renderCalendar();
        return;
      }

      const clearBtn = e.target.closest('.btn-clear-date');
      if (clearBtn) {
        input.value = '';
        dropdown.classList.remove('show');
        selectedInput = null;
        input.dispatchEvent(new Event('change', { bubbles: true }));
      }
    };

    setTimeout(() => {
      document.addEventListener('click', dropdown._handleClick);
    }, 0);
  }

  function hideCalendar() {
    if (dropdown) {
      dropdown.classList.remove('show');
      if (dropdown._handleClick) {
        document.removeEventListener('click', dropdown._handleClick);
        dropdown._handleClick = null;
      }
    }
    selectedInput = null;
  }

  function initCalendario() {
    dropdown = document.getElementById('calendarDropdown');
    if (!dropdown) return;

    const wraps = document.querySelectorAll('.calendar-input-wrap');

    wraps.forEach(function (wrap) {
      const input = wrap.querySelector('input');
      const icon = wrap.querySelector('.calendar-icon');

      if (!input || !icon) return;

      const openCalendar = function (e) {
        e.stopPropagation();
        if (dropdown.classList.contains('show')) {
          hideCalendar();
        }
        showCalendar(input);
      };

      icon.addEventListener('click', openCalendar);
      input.addEventListener('click', openCalendar);
      input.addEventListener('keydown', function (e) {
        if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          showCalendar(input);
        }
      });
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && dropdown && dropdown.classList.contains('show')) {
        hideCalendar();
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initCalendario);
  } else {
    initCalendario();
  }

  window.initCalendario = initCalendario;
})();
