/* ------------------------------------------------------------------
 * ui.js — 基础 UI 元件：图标、轻提示、弹层
 * ---------------------------------------------------------------- */
(function (window) {
  'use strict';

  var PATHS = {
    plus: '<path d="M12 5v14M5 12h14"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>',
    check: '<path d="M20 6L9 17l-5-5"/>',
    alert: '<path d="M12 9v4M12 17h.01"/><path d="M10.3 3.9L1.9 18a2 2 0 0 0 1.7 3h16.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 16v-4M12 8h.01"/>',
    doc: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M9 13h6M9 17h4"/>',
    chat: '<path d="M8 9h8M8 13h5"/><path d="M21 12a8 8 0 0 1-11.6 7.1L4 21l1.9-5.4A8 8 0 1 1 21 12z"/>',
    chart: '<path d="M4 19h16"/><rect x="6" y="10" width="3" height="6" rx="1"/><rect x="11" y="6" width="3" height="10" rx="1"/><rect x="16" y="12" width="3" height="4" rx="1"/>',
    calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
    spark: '<path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z"/><path d="M18.5 15.5l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8z"/>',
    link: '<path d="M10 13a5 5 0 0 0 7.5.5l2-2a5 5 0 0 0-7-7l-1 1"/><path d="M14 11a5 5 0 0 0-7.5-.5l-2 2a5 5 0 0 0 7 7l1-1"/>',
    shield: '<path d="M12 3l7 3v6c0 4.5-3 7.7-7 9-4-1.3-7-4.5-7-9V6z"/><path d="M9 12l2 2 4-4"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    upload: '<path d="M12 16V4M7 9l5-5 5 5"/><path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"/>',
    download: '<path d="M12 4v12M7 11l5 5 5-5"/><path d="M4 18v1a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-1"/>',
    trash: '<path d="M4 7h16M9 7V5h6v2M6 7l1 13h10l1-13"/>',
    edit: '<path d="M4 20h4l10-10-4-4L4 16z"/><path d="M14 6l3-3 4 4-3 3"/>',
    x: '<path d="M6 6l12 12M18 6L6 18"/>',
    arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
    refresh: '<path d="M20 11a8 8 0 1 0-2.3 5.7"/><path d="M20 5v6h-6"/>',
    send: '<path d="M4 12l16-8-6 16-3-7z"/>',
    briefcase: '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2M3 12h18"/>',
    user: '<circle cx="12" cy="8" r="3.5"/><path d="M5 20c0-3.6 3.1-6 7-6s7 2.4 7 6"/>',
    star: '<path d="M12 3l2.6 5.6 6.4.8-4.6 4.4 1.2 6.2L12 17l-5.6 3 1.2-6.2L3 9.4l6.4-.8z"/>',
    lock: '<rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',
    layers: '<path d="M12 3l9 5-9 5-9-5z"/><path d="M3 13l9 5 9-5"/>'
  };

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function icon(name, size) {
    var p = PATHS[name] || PATHS.info;
    var n = size || 15;
    return '<svg viewBox="0 0 24 24" width="' + n + '" height="' + n + '" fill="none" stroke="currentColor" ' +
      'stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" style="flex:0 0 auto">' + p + '</svg>';
  }

  /* ------------------------------ Toast ------------------------------ */
  var toastRoot = null;
  function toast(msg, type) {
    if (!toastRoot) toastRoot = document.getElementById('toast-root');
    if (!toastRoot) return;
    var el = document.createElement('div');
    el.className = 'toast ' + (type || '');
    el.innerHTML = (type === 'ok' ? icon('check') : type === 'warn' ? icon('alert') : icon('info')) + '<span>' + esc(msg) + '</span>';
    toastRoot.appendChild(el);
    setTimeout(function () {
      el.style.transition = 'opacity .3s, transform .3s';
      el.style.opacity = '0';
      el.style.transform = 'translateY(6px)';
      setTimeout(function () { el.remove(); }, 320);
    }, 3200);
  }

  /* ------------------------------ Modal ------------------------------ */
  var openModals = [];

  function modal(opts) {
    var root = document.getElementById('modal-root');
    var mask = document.createElement('div');
    mask.className = 'modal-mask';
    var footHtml = '';
    if (opts.actions && opts.actions.length) {
      footHtml = '<div class="modal-foot">' +
        (opts.footLeft || '') +
        '<span class="spacer"></span>' +
        opts.actions.map(function (a, i) {
          return '<button class="btn ' + (a.cls || '') + '" data-midx="' + i + '">' + (a.icon ? icon(a.icon) : '') + esc(a.label) + '</button>';
        }).join('') + '</div>';
    }
    mask.innerHTML = '<div class="modal ' + (opts.wide ? 'wide' : '') + '">' +
      '<div class="modal-head"><h3>' + esc(opts.title || '') + '</h3>' +
        '<span class="spacer" style="flex:1"></span>' +
        '<button class="icon-btn" data-mclose="1" title="关闭">' + icon('x') + '</button>' +
      '</div>' +
      '<div class="modal-body">' + (opts.body || '') + '</div>' +
      footHtml + '</div>';
    root.appendChild(mask);
    openModals.push(mask);

    function close() {
      mask.remove();
      openModals = openModals.filter(function (m) { return m !== mask; });
      if (opts.onClose) opts.onClose();
    }
    mask.addEventListener('click', function (e) {
      if (e.target === mask && opts.maskClose !== false) close();
      if (e.target.closest('[data-mclose]')) close();
    });
    (opts.actions || []).forEach(function (a, i) {
      var btn = mask.querySelector('[data-midx="' + i + '"]');
      if (btn) btn.addEventListener('click', function () { a.onClick ? a.onClick(mask, close) : close(); });
    });
    if (opts.onMount) opts.onMount(mask, close);
    return { el: mask, close: close };
  }

  function confirmDialog(opts) {
    return modal({
      title: opts.title || '确认操作',
      body: '<div class="small" style="color:var(--text-2);line-height:1.75">' + (opts.body || '') + '</div>',
      actions: [
        { label: '取消', cls: 'btn-ghost', onClick: function (m, close) { close(); if (opts.onCancel) opts.onCancel(); } },
        { label: opts.okLabel || '确认', cls: opts.danger ? 'btn-danger' : 'btn-primary', onClick: function (m, close) { close(); opts.onOk(); } }
      ]
    });
  }

  window.UI = {
    icon: icon,
    esc: esc,
    toast: toast,
    modal: modal,
    confirm: confirmDialog
  };
})(window);
