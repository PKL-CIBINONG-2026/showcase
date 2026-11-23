(() => {
  'use strict';

  const FALLBACK_NEON_PALETTE = [
    '#83D6C5',
    '#EBCB8B',
    '#88C0D0',
    '#E394DC',
    '#EFB080',
    '#AAA0FA',
    '#A3BE8C',
  ];
  const HOVER_INTENT_MS = 130;
  const CLOSE_GRACE_MS = 220;
  const IFRAME_TIMEOUT_MS = 4000;
  const DESKTOP_BREAKPOINT = 768;
  const THEME_STORAGE_KEY = 'pkl-showcase-theme';

  const state = {
    data: null,
    activeCategories: new Map(),
    activeTask: null,
    activeRowEl: null,
    lastFocusedEl: null,
    isPinned: false,
    previewMode: 'iframe',
    iframeLoadedUrl: '',
    hoverTimer: null,
    closeTimer: null,
    loadTimer: null,
  };

  const dom = {
    repoOwner: document.getElementById('repo-owner'),
    repoName: document.getElementById('repo-name'),
    footerOwner: document.getElementById('footer-owner'),
    footerRepoLink: document.getElementById('footer-repo-link'),
    themeButtons: document.querySelectorAll('.theme-btn'),
    repoTree: document.getElementById('repo-tree'),
    backdrop: document.getElementById('popover-backdrop'),
    popover: document.getElementById('preview-popover'),
    popoverCat: document.getElementById('popover-cat'),
    popoverTitle: document.getElementById('popover-title'),
    popoverModeBtn: document.getElementById('popover-mode-btn'),
    popoverClose: document.getElementById('popover-close'),
    popoverStatusDot: document.getElementById('popover-status-dot'),
    popoverUrlDisplay: document.getElementById('popover-url-display'),
    popoverStatusText: document.getElementById('popover-status-text'),
    popoverStage: document.getElementById('popover-stage'),
    popoverLoading: document.getElementById('popover-loading'),
    popoverIframe: document.getElementById('popover-iframe'),
    popoverThumb: document.getElementById('popover-thumb'),
    popoverRepoBtn: document.getElementById('popover-repo-btn'),
    popoverFullBtn: document.getElementById('popover-full-btn'),
  };

  function sanitizeUrl(raw) {
    if (typeof raw !== 'string') return '';
    const trimmed = raw.trim();
    if (!trimmed) return '';
    if (/^(javascript|vbscript|data:text\/html)/i.test(trimmed)) return '';
    try {
      const parsed = new URL(trimmed, window.location.href);
      if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
        return parsed.href;
      }
      if (
        window.location.protocol === 'file:' &&
        parsed.protocol === 'file:' &&
        !/^[a-z]+:/i.test(trimmed)
      ) {
        return trimmed;
      }
      return '';
    } catch {
      return '';
    }
  }

  function hashString(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i += 1) {
      hash = (hash * 31 + str.charCodeAt(i)) >>> 0;
    }
    return hash;
  }

  function getContrastInk(hexColor) {
    if (typeof hexColor !== 'string') return '#141414';
    let hex = hexColor.replace('#', '').trim();
    if (hex.length === 3) {
      hex = hex
        .split('')
        .map((c) => c + c)
        .join('');
    }
    if (!/^[0-9a-fA-F]{6}$/.test(hex)) return '#141414';
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    const yiq = (r * 299 + g * 587 + b * 114) / 1000;
    return yiq >= 135 ? '#141414' : '#d8dee9';
  }

  function getInitials(name) {
    const words = String(name || 'PKL')
      .trim()
      .split(/\s+/)
      .filter(Boolean);
    if (words.length === 0) return 'PK';
    if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
    return (words[0][0] + words[words.length - 1][0]).toUpperCase();
  }

  function slugify(str) {
    return (
      String(str || 'uncategorized')
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '') || 'uncategorized'
    );
  }

  function resolveCategory(rawCategory, categoriesMap) {
    const raw = String(rawCategory || 'Lainnya').trim();
    const key = slugify(raw);
    const configured = categoriesMap.get(raw) || categoriesMap.get(key);
    if (configured) return configured;

    const color = FALLBACK_NEON_PALETTE[hashString(key) % FALLBACK_NEON_PALETTE.length];
    return {
      key,
      label: raw,
      color,
      ink: getContrastInk(color),
    };
  }

  function normalizeData(raw) {
    const repo = raw && typeof raw.repository === 'object' ? raw.repository : {};
    const rawCategories = raw && typeof raw.categories === 'object' ? raw.categories : {};
    const categoriesMap = new Map();
    const orderedKeys = [];

    Object.entries(rawCategories).forEach(([key, cfg]) => {
      const cleanKey = slugify(key);
      const label = cfg && cfg.label ? String(cfg.label) : key;
      const color =
        cfg && typeof cfg.color === 'string' && cfg.color.trim()
          ? cfg.color.trim()
          : FALLBACK_NEON_PALETTE[hashString(cleanKey) % FALLBACK_NEON_PALETTE.length];
      const entry = {
        key: cleanKey,
        label,
        color,
        ink: getContrastInk(color),
      };
      categoriesMap.set(key, entry);
      categoriesMap.set(cleanKey, entry);
      if (!orderedKeys.includes(cleanKey)) orderedKeys.push(cleanKey);
    });

    const rawStudents = Array.isArray(raw && raw.students) ? raw.students : [];
    const students = rawStudents.map((st, idx) => {
      const name = st && st.name ? String(st.name) : `Peserta ${idx + 1}`;
      const id = st && st.id ? slugify(st.id) : slugify(`${name}-${idx}`);
      const github = st && st.github ? String(st.github).replace(/^@/, '') : '';
      const profileUrl =
        sanitizeUrl(st && st.profileUrl) ||
        (github ? `https://github.com/${encodeURIComponent(github)}` : '');
      const rawTasks = Array.isArray(st && st.tasks) ? st.tasks : [];

      const tasks = rawTasks
        .map((t, tIdx) => {
          const cat = resolveCategory(t && t.category, categoriesMap);
          if (!categoriesMap.has(cat.key)) {
            categoriesMap.set(cat.key, cat);
            orderedKeys.push(cat.key);
          }
          const pagesUrl = sanitizeUrl(t && t.pagesUrl);
          const repoUrl = sanitizeUrl(t && t.repoUrl);
          if (!pagesUrl && !repoUrl) return null;
          return {
            id: `${id}-${tIdx}`,
            title: t && t.title ? String(t.title) : `tugas-${tIdx + 1}`,
            description: t && t.description ? String(t.description) : '',
            categoryKey: cat.key,
            category: cat,
            pagesUrl,
            repoUrl,
            repoOnly: !pagesUrl,
            viewerUrl: !pagesUrl ? buildViewerUrl(repoUrl) : '',
            thumbnail: sanitizeUrl(t && t.thumbnail),
            updatedAt: t && t.updatedAt ? String(t.updatedAt) : '',
            studentId: id,
            studentName: name,
            studentGithub: github,
          };
        })
        .filter(Boolean);

      return {
        id,
        name,
        github,
        profileUrl,
        role: st && st.role ? String(st.role) : '',
        batch: st && st.batch ? String(st.batch) : '',
        avatar: sanitizeUrl(st && st.avatar),
        tasks,
      };
    });

    return {
      repository: {
        owner: repo.owner ? String(repo.owner) : 'PKL-CIBINONG-2026',
        name: repo.name ? String(repo.name) : 'showcase',
        repoUrl: sanitizeUrl(repo.repoUrl),
      },
      categoryOrder: orderedKeys,
      students,
    };
  }

  function createEl(tag, className, text) {
    const el = document.createElement(tag);
    if (className) el.className = className;
    if (text !== undefined) el.textContent = text;
    return el;
  }

  const SVG_NS = 'http://www.w3.org/2000/svg';
  const ICON_PATHS = {
    code: 'M4.72 3.22a.75.75 0 0 1 1.06 1.06L2.06 8l3.72 3.72a.75.75 0 1 1-1.06 1.06L.47 8.53a.75.75 0 0 1 0-1.06Zm6.56 0a.75.75 0 1 0-1.06 1.06L13.94 8l-3.72 3.72a.75.75 0 1 0 1.06 1.06l4.25-4.25a.75.75 0 0 0 0-1.06Z',
    globe: 'M8 0a8 8 0 1 1 0 16A8 8 0 0 1 8 0ZM5.78 8.75a9.64 9.64 0 0 0 1.363 4.177c.255.426.542.832.857 1.215.245-.296.551-.705.857-1.215A9.64 9.64 0 0 0 10.22 8.75Zm4.44-1.5a9.64 9.64 0 0 0-1.363-4.177c-.307-.51-.612-.919-.857-1.215a9.927 9.927 0 0 0-.857 1.215A9.64 9.64 0 0 0 5.78 7.25Zm-5.944 1.5H1.543a6.507 6.507 0 0 0 4.666 5.5c-.123-.181-.24-.365-.352-.552-.715-1.192-1.437-2.874-1.581-4.948Zm-2.733-1.5h2.733c.144-2.074.866-3.756 1.58-4.948.12-.197.237-.381.353-.552a6.507 6.507 0 0 0-4.666 5.5Zm10.181 1.5c-.144 2.074-.866 3.756-1.58 4.948-.12.197-.237.381-.353.552a6.507 6.507 0 0 0 4.666-5.5Zm2.733-1.5a6.507 6.507 0 0 0-4.666-5.5c.123.181.24.365.353.552.714 1.192 1.436 2.874 1.58 4.948Z',
  };

  function createIconSvg(name, size, className) {
    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('width', String(size));
    svg.setAttribute('height', String(size));
    svg.setAttribute('viewBox', '0 0 16 16');
    svg.setAttribute('fill', 'currentColor');
    svg.setAttribute('aria-hidden', 'true');
    if (className) svg.classList.add(className);
    const path = document.createElementNS(SVG_NS, 'path');
    path.setAttribute('d', ICON_PATHS[name]);
    svg.appendChild(path);
    return svg;
  }

  function createCategoryBadge(categoryKey) {
    const isJs = /javascript|^js$/i.test(categoryKey);
    const badge = createEl('span', `cat-icon ${isJs ? 'cat-icon--js' : 'cat-icon--code'}`);
    badge.setAttribute('aria-hidden', 'true');
    if (isJs) badge.textContent = 'JS';
    else badge.appendChild(createIconSvg('code', 12));
    return badge;
  }

  function createFileIconSvg() {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', '15');
    svg.setAttribute('height', '15');
    svg.setAttribute('viewBox', '0 0 16 16');
    svg.setAttribute('fill', 'currentColor');
    svg.setAttribute('aria-hidden', 'true');
    svg.classList.add('file-icon');
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute(
      'd',
      'M2 1.75C2 .784 2.784 0 3.75 0h6.586c.464 0 .909.184 1.237.513l2.914 2.914c.329.328.513.773.513 1.237v9.586A1.75 1.75 0 0 1 13.25 16h-9.5A1.75 1.75 0 0 1 2 14.25Zm1.75-.25a.25.25 0 0 0-.25.25v12.5c0 .138.112.25.25.25h9.5a.25.25 0 0 0 .25-.25V6h-2.75A1.75 1.75 0 0 1 9 4.25V1.5Zm6.75.062V4.25c0 .138.112.25.25.25h2.688l-.011-.013-2.914-2.914-.013-.011Z'
    );
    svg.appendChild(path);
    return svg;
  }

  function createFolderIconSvg(isOpen) {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', '16');
    svg.setAttribute('height', '16');
    svg.setAttribute('viewBox', '0 0 16 16');
    svg.setAttribute('fill', 'currentColor');
    svg.setAttribute('aria-hidden', 'true');
    svg.classList.add('folder-icon');
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute(
      'd',
      isOpen
        ? 'M.513 1.513A1.75 1.75 0 0 1 1.75 1h3.5c.55 0 1.07.26 1.4.7l.9 1.2a.25.25 0 0 0 .2.1h6.5A1.75 1.75 0 0 1 16 4.75v1.5a.75.75 0 0 1-1.5 0v-1.5a.25.25 0 0 0-.25-.25H7.75a1.75 1.75 0 0 1-1.4-.7l-.9-1.2a.25.25 0 0 0-.2-.1h-3.5a.25.25 0 0 0-.25.25v8.72l1.624-4.87A1.25 1.25 0 0 1 4.31 5.75h10.44a1.25 1.25 0 0 1 1.186 1.645l-1.917 5.75A2 2 0 0 1 12.122 14.5H1.75A1.75 1.75 0 0 1 0 12.75V2.75c0-.464.184-.909.513-1.237Z'
        : 'M1.75 1A1.75 1.75 0 0 0 0 2.75v10.5C0 14.216.784 15 1.75 15h12.5A1.75 1.75 0 0 0 16 13.25v-8.5A1.75 1.75 0 0 0 14.25 3H7.5a.25.25 0 0 1-.2-.1l-.9-1.2C6.07 1.26 5.55 1 5 1H1.75Z'
    );
    svg.appendChild(path);
    return svg;
  }

  function groupTasksByCategory(tasks) {
    const groups = new Map();
    tasks.forEach((task) => {
      if (!groups.has(task.categoryKey)) {
        groups.set(task.categoryKey, {
          category: task.category,
          tasks: [],
        });
      }
      groups.get(task.categoryKey).tasks.push(task);
    });

    const order = state.data.categoryOrder;
    return Array.from(groups.values()).sort((a, b) => {
      const idxA = order.indexOf(a.category.key);
      const idxB = order.indexOf(b.category.key);
      if (idxA !== -1 && idxB !== -1) return idxA - idxB;
      if (idxA !== -1) return -1;
      if (idxB !== -1) return 1;
      return a.category.label.localeCompare(b.category.label);
    });
  }

  function buildViewerUrl(repoUrl) {
    const m = /^https:\/\/github\.com\/PKL-CIBINONG-2026\/([A-Za-z0-9._-]+)\/?$/.exec(repoUrl || '');
    return m ? `./viewer.html?repo=${encodeURIComponent(m[1])}` : '';
  }

  function buildTaskRow(task) {
    const li = createEl('li', 'task-row');
    li.style.setProperty('--cat-color', task.category.color);
    li.style.setProperty('--cat-ink', task.category.ink);

    const mainCol = createEl('div', 'task-main');
    const typeIcon = createEl('span', `task-type-icon ${task.repoOnly ? 'is-code' : 'is-live'}`);
    typeIcon.title = task.repoOnly ? 'Kode sumber' : 'Live preview';
    typeIcon.appendChild(createIconSvg(task.repoOnly ? 'code' : 'globe', 14));
    mainCol.appendChild(typeIcon);

    const titleWrap = createEl('div', 'task-title-wrap');
    const titleLine = createEl('div', 'task-title-line');
    const titleLink = createEl('a', 'task-title-link', task.title);
    titleLink.href = task.pagesUrl || task.viewerUrl || task.repoUrl;
    titleLink.target = '_blank';
    titleLink.rel = 'noopener noreferrer';
    titleLine.appendChild(titleLink);

    if (task.updatedAt) {
      titleLine.appendChild(createEl('span', 'task-date', task.updatedAt));
    }

    titleWrap.appendChild(titleLine);
    if (task.description) {
      const desc = createEl('p', 'task-desc', task.description);
      desc.title = task.description;
      titleWrap.appendChild(desc);
    }
    mainCol.appendChild(titleWrap);

    const openLink = createEl('a', 'task-open-btn', task.repoOnly ? 'FILES ↗' : 'VIEW ↗');
    openLink.href = task.pagesUrl || task.viewerUrl || task.repoUrl;
    if (task.repoOnly) li.classList.add('is-repo-only');
    openLink.target = '_blank';
    openLink.rel = 'noopener noreferrer';

    li.appendChild(mainCol);
    li.appendChild(openLink);

    li.addEventListener('mouseenter', () => {
      if (task.repoOnly) return;
      if (window.innerWidth < DESKTOP_BREAKPOINT) return;
      if (state.isPinned) return;
      if (state.activeTask && state.activeTask.id === task.id && !dom.popover.hidden) {
        clearCloseTimer();
        clearHoverTimer();
        return;
      }
      scheduleHoverOpen(task, li);
    });

    li.addEventListener('mouseleave', () => {
      if (state.isPinned) return;
      clearHoverTimer();
      scheduleClosePreview();
    });

    return li;
  }

  function setStudentActiveFolder(body, student, groupedCategories, nextKey, focusSelector) {
    if (state.activeTask && state.activeTask.studentId === student.id) {
      closePreview();
    }
    state.activeCategories.set(student.id, nextKey);
    renderStudentBody(body, student, groupedCategories);
    if (focusSelector) {
      const target = body.querySelector(focusSelector);
      if (target) target.focus();
    }
  }

  function renderFolderNav(body, student, groupedCategories, activeCatKey) {
    const nav = createEl('nav', 'folder-nav');
    nav.setAttribute('aria-label', `Navigasi folder ${student.name}`);

    const left = createEl('div', 'folder-nav-left');
    const right = createEl('div', 'folder-nav-right');
    const rootName = student.github || student.id;

    const activeIdx = activeCatKey
      ? groupedCategories.findIndex((g) => g.category.key === activeCatKey)
      : -1;
    const activeGroup = activeIdx >= 0 ? groupedCategories[activeIdx] : null;

    if (!activeGroup) {
      left.appendChild(createEl('span', 'nav-root-pill', 'ROOT'));
      left.appendChild(createEl('span', 'nav-crumb-current', `${rootName} /`));
      right.appendChild(
        createEl('span', 'nav-hint', `${groupedCategories.length} FOLDER`)
      );
    } else {
      const backBtn = createEl('button', 'nav-back-btn', '← ..');
      backBtn.type = 'button';
      backBtn.title = 'Kembali ke daftar folder';
      backBtn.addEventListener('click', () => {
        setStudentActiveFolder(body, student, groupedCategories, null, '.folder-row');
      });
      left.appendChild(backBtn);

      const crumbs = createEl('div', 'nav-breadcrumbs');
      const rootBtn = createEl('button', 'nav-crumb-link', rootName);
      rootBtn.type = 'button';
      rootBtn.addEventListener('click', () => {
        setStudentActiveFolder(body, student, groupedCategories, null, '.folder-row');
      });
      crumbs.appendChild(rootBtn);
      crumbs.appendChild(createEl('span', 'nav-crumb-sep', '/'));

      const activeCrumb = createEl(
        'span',
        'nav-crumb-active',
        `${activeGroup.category.label}/`
      );
      activeCrumb.style.setProperty('--cat-color', activeGroup.category.color);
      crumbs.appendChild(activeCrumb);
      left.appendChild(crumbs);

      if (groupedCategories.length > 1) {
        const prevIdx =
          (activeIdx - 1 + groupedCategories.length) % groupedCategories.length;
        const nextIdx = (activeIdx + 1) % groupedCategories.length;

        const prevBtn = createEl('button', 'nav-step-btn', '◀');
        prevBtn.type = 'button';
        prevBtn.title = `Folder sebelumnya (${groupedCategories[prevIdx].category.label})`;
        prevBtn.addEventListener('click', () => {
          const targetKey = groupedCategories[prevIdx].category.key;
          setStudentActiveFolder(body, student, groupedCategories, targetKey, '.nav-step-btn');
        });

        const nextBtn = createEl('button', 'nav-step-btn', '▶');
        nextBtn.type = 'button';
        nextBtn.title = `Folder berikutnya (${groupedCategories[nextIdx].category.label})`;
        nextBtn.addEventListener('click', () => {
          const targetKey = groupedCategories[nextIdx].category.key;
          setStudentActiveFolder(
            body,
            student,
            groupedCategories,
            targetKey,
            '.nav-step-btn:last-of-type'
          );
        });

        right.appendChild(prevBtn);
        right.appendChild(
          createEl('span', 'nav-counter', `${activeIdx + 1}/${groupedCategories.length}`)
        );
        right.appendChild(nextBtn);
      }

      const closeBtn = createEl('button', 'nav-close-btn', '×');
      closeBtn.type = 'button';
      closeBtn.title = 'Tutup folder aktif';
      closeBtn.setAttribute('aria-label', 'Tutup folder aktif');
      closeBtn.addEventListener('click', () => {
        setStudentActiveFolder(body, student, groupedCategories, null, '.folder-row');
      });
      right.appendChild(closeBtn);
    }

    nav.appendChild(left);
    nav.appendChild(right);
    return nav;
  }

  function renderStudentBody(body, student, groupedCategories) {
    body.replaceChildren();

    if (groupedCategories.length === 0) {
      body.appendChild(
        createEl('div', 'folder-empty', 'Belum ada folder kategori atau tugas terdaftar.')
      );
      return;
    }

    const activeCatKey = state.activeCategories.get(student.id) || null;
    body.appendChild(renderFolderNav(body, student, groupedCategories, activeCatKey));

    const orderedGroups = groupedCategories;

    const folderList = createEl('div', 'folder-list');
    folderList.setAttribute('role', 'group');
    folderList.setAttribute('aria-label', `Folder kategori ${student.name}`);

    orderedGroups.forEach(({ category, tasks: catTasks }) => {
      const isActive = activeCatKey === category.key;

      const folderBtn = createEl('button', 'folder-row');
      folderBtn.type = 'button';
      folderBtn.dataset.category = category.key;
      folderBtn.setAttribute('aria-expanded', String(isActive));
      folderBtn.style.setProperty('--cat-color', category.color);
      folderBtn.style.setProperty('--cat-ink', category.ink);
      if (isActive) folderBtn.classList.add('is-active');

      const left = createEl('span', 'folder-row-left');
      left.appendChild(createFolderIconSvg(isActive));
      left.appendChild(createCategoryBadge(category.key));
      left.appendChild(createEl('span', 'folder-name', `${category.label}/`));
      if (isActive) {
        left.appendChild(createEl('span', 'folder-active-tag', 'ACTIVE'));
      }

      const right = createEl('span', 'folder-row-right');
      const latestDate = catTasks
        .map((t) => t.updatedAt)
        .filter(Boolean)
        .sort()
        .pop();
      const metaText = latestDate
        ? `${catTasks.length} item · ${latestDate}`
        : `${catTasks.length} item`;
      right.appendChild(createEl('span', 'folder-meta', metaText));
      right.appendChild(createEl('span', 'folder-caret', isActive ? '▼' : '▶'));

      folderBtn.appendChild(left);
      folderBtn.appendChild(right);

      folderBtn.addEventListener('click', () => {
        const next = isActive ? null : category.key;
        setStudentActiveFolder(
          body,
          student,
          groupedCategories,
          next,
          `.folder-row[data-category="${category.key}"]`
        );
      });

      folderList.appendChild(folderBtn);

      if (isActive) {
        const filesWrap = createEl('div', 'folder-files');
        filesWrap.style.setProperty('--cat-color', category.color);
        filesWrap.style.setProperty('--cat-ink', category.ink);

        const ul = createEl('ul', 'task-list');
        catTasks.forEach((task) => {
          ul.appendChild(buildTaskRow(task));
        });

        filesWrap.appendChild(ul);
        folderList.appendChild(filesWrap);
      }
    });

    body.appendChild(folderList);
  }

  function renderGrid() {
    const { repository, students } = state.data;
    document.title = `${repository.owner} / ${repository.name}`;
    if (dom.repoOwner) dom.repoOwner.textContent = repository.owner;
    if (dom.repoName) dom.repoName.textContent = repository.name;
    if (dom.footerOwner) dom.footerOwner.textContent = repository.owner;
    if (dom.footerRepoLink) {
      if (repository.repoUrl) {
        dom.footerRepoLink.href = repository.repoUrl;
        dom.footerRepoLink.hidden = false;
      } else {
        dom.footerRepoLink.hidden = true;
      }
    }
    dom.repoTree.replaceChildren();

    if (students.length === 0) {
      dom.repoTree.appendChild(
        createEl('div', 'status-banner', 'BELUM ADA PESERTA DI DATA/SHOWCASE.JS.')
      );
      return;
    }

    students.forEach((student) => {
      const section = createEl('section', 'student-dir');
      section.dataset.studentId = student.id;

      const header = createEl('div', 'student-dir-header');
      const left = createEl('div', 'student-dir-left');

      const avatarBox = createEl('span', 'student-avatar');
      if (student.avatar) {
        const img = document.createElement('img');
        img.src = student.avatar;
        img.alt = student.name;
        img.loading = 'lazy';
        img.addEventListener('error', () => {
          avatarBox.replaceChildren();
          avatarBox.textContent = getInitials(student.name);
        });
        avatarBox.appendChild(img);
      } else {
        avatarBox.textContent = getInitials(student.name);
      }
      left.appendChild(avatarBox);

      const meta = createEl('div', 'student-meta');
      const nameRow = createEl('div', 'student-name-row');
      nameRow.appendChild(createEl('span', 'student-name', `${student.name}/`));

      if (student.github) {
        if (student.profileUrl) {
          const handleLink = createEl('a', 'student-handle', `@${student.github} ↗`);
          handleLink.href = student.profileUrl;
          handleLink.target = '_blank';
          handleLink.rel = 'noopener noreferrer';
          nameRow.appendChild(handleLink);
        } else {
          nameRow.appendChild(createEl('span', 'student-handle', `@${student.github}`));
        }
      }
      meta.appendChild(nameRow);

      const subParts = [student.role, student.batch].filter(Boolean);
      if (subParts.length > 0) {
        meta.appendChild(createEl('span', 'student-sub', subParts.join(' · ')));
      }
      left.appendChild(meta);

      const groupedCategories = groupTasksByCategory(student.tasks);
      const right = createEl('div', 'student-dir-right');
      right.appendChild(
        createEl('span', 'student-count-badge', `${student.tasks.length} TUGAS`)
      );

      header.appendChild(left);
      header.appendChild(right);

      const body = createEl('div', 'student-dir-body');
      renderStudentBody(body, student, groupedCategories);

      section.appendChild(header);
      section.appendChild(body);
      dom.repoTree.appendChild(section);
    });
  }

  /* =========================================================
     Hover / Pin Live Preview Popover Controller
     ========================================================= */
  function clearHoverTimer() {
    if (state.hoverTimer) {
      clearTimeout(state.hoverTimer);
      state.hoverTimer = null;
    }
  }

  function clearCloseTimer() {
    if (state.closeTimer) {
      clearTimeout(state.closeTimer);
      state.closeTimer = null;
    }
  }

  function clearLoadTimer() {
    if (state.loadTimer) {
      clearTimeout(state.loadTimer);
      state.loadTimer = null;
    }
  }

  function scheduleHoverOpen(task, rowEl) {
    clearCloseTimer();
    clearHoverTimer();
    state.hoverTimer = setTimeout(() => {
      openPreview(task, rowEl, { pin: false });
    }, HOVER_INTENT_MS);
  }

  function scheduleClosePreview() {
    clearCloseTimer();
    state.closeTimer = setTimeout(() => {
      closePreview();
    }, CLOSE_GRACE_MS);
  }

  function updateIframeScale() {
    const stageWidth = dom.popoverStage.clientWidth;
    if (!stageWidth) return;
    const scale = stageWidth / 1280;
    dom.popoverIframe.style.transform = `scale(${scale})`;
  }

  function setLoadingState(isLoading, statusLabel) {
    dom.popoverLoading.hidden = !isLoading;
    dom.popoverStatusDot.classList.toggle('is-ready', !isLoading);
    dom.popoverStatusText.textContent = statusLabel;
  }

  function applyPreviewMode(task, mode) {
    state.previewMode = mode;
    clearLoadTimer();

    if (mode === 'thumb' && task.thumbnail) {
      dom.popoverIframe.hidden = true;
      dom.popoverIframe.dataset.targetUrl = '';
      dom.popoverIframe.src = 'about:blank';
      state.iframeLoadedUrl = '';
      dom.popoverThumb.hidden = false;
      if (dom.popoverThumb.getAttribute('src') !== task.thumbnail) {
        setLoadingState(true, 'LOADING IMG');
        dom.popoverThumb.src = task.thumbnail;
      } else if (dom.popoverThumb.complete) {
        setLoadingState(false, 'SNAPSHOT');
      }
      dom.popoverModeBtn.textContent = 'LIVE IFRAME';
      return;
    }

    dom.popoverThumb.hidden = true;
    dom.popoverIframe.hidden = false;
    dom.popoverModeBtn.textContent = 'IMG MODE';

    if (
      dom.popoverIframe.dataset.targetUrl === task.pagesUrl &&
      state.iframeLoadedUrl === task.pagesUrl
    ) {
      setLoadingState(false, 'LIVE PREVIEW');
      return;
    }

    state.iframeLoadedUrl = '';
    setLoadingState(true, 'CONNECTING');

    if (dom.popoverIframe.dataset.targetUrl !== task.pagesUrl) {
      dom.popoverIframe.dataset.targetUrl = task.pagesUrl;
      dom.popoverIframe.src = task.pagesUrl;
    }

    state.loadTimer = setTimeout(() => {
      if (state.activeTask && state.activeTask.pagesUrl === task.pagesUrl) {
        state.iframeLoadedUrl = task.pagesUrl;
        setLoadingState(false, 'READY / EXT');
      }
    }, IFRAME_TIMEOUT_MS);
  }

  function positionPopover(rowEl) {
    const isNarrow = window.innerWidth < DESKTOP_BREAKPOINT;
    if (isNarrow || !rowEl) {
      dom.popover.classList.add('is-mobile-drawer');
      dom.popover.style.left = '';
      dom.popover.style.top = '';
      dom.backdrop.hidden = false;
      return;
    }

    dom.popover.classList.remove('is-mobile-drawer');
    dom.backdrop.hidden = !state.isPinned;

    const margin = 14;
    const rect = rowEl.getBoundingClientRect();
    const popRect = dom.popover.getBoundingClientRect();
    const popW = popRect.width || 440;
    const popH = popRect.height || 370;

    let left = rect.right - popW - 12;
    if (left < margin) left = margin;
    if (left + popW > window.innerWidth - margin) {
      left = window.innerWidth - popW - margin;
    }

    let top = rect.bottom + 4;
    if (top + popH > window.innerHeight - margin) {
      const aboveTop = rect.top - popH - 4;
      if (aboveTop >= margin) {
        top = aboveTop;
      } else {
        top = Math.max(margin, window.innerHeight - popH - margin);
      }
    }

    dom.popover.style.left = `${Math.round(left)}px`;
    dom.popover.style.top = `${Math.round(top)}px`;
  }

  function openPreview(task, rowEl, { pin = false } = {}) {
    if (task.repoOnly) return;
    clearCloseTimer();
    clearHoverTimer();

    if (state.activeRowEl && state.activeRowEl !== rowEl) {
      state.activeRowEl.classList.remove('is-preview-active');
    }

    state.activeTask = task;
    state.activeRowEl = rowEl;
    state.isPinned = pin;

    if (rowEl) rowEl.classList.add('is-preview-active');

    dom.popover.style.setProperty('--cat-color', task.category.color);
    dom.popover.style.setProperty('--cat-ink', task.category.ink);
    dom.popoverCat.textContent = '';
    dom.popoverCat.appendChild(createCategoryBadge(task.category.key));
    dom.popoverCat.appendChild(document.createTextNode(task.category.label));
    dom.popoverTitle.textContent = task.title;
    dom.popoverUrlDisplay.textContent = task.pagesUrl;
    dom.popoverFullBtn.href = task.pagesUrl;

    if (task.repoUrl) {
      dom.popoverRepoBtn.href = task.repoUrl;
      dom.popoverRepoBtn.hidden = false;
    } else {
      dom.popoverRepoBtn.hidden = true;
    }

    dom.popoverModeBtn.hidden = !task.thumbnail;

    dom.popover.hidden = false;
    dom.popover.setAttribute('aria-hidden', 'false');

    updateIframeScale();
    positionPopover(rowEl);

    const initialMode = task.thumbnail ? 'thumb' : 'iframe';
    applyPreviewMode(task, initialMode);

    if (pin) {
      state.lastFocusedEl =
        document.activeElement instanceof HTMLElement ? document.activeElement : null;
      dom.popoverFullBtn.focus();
    }
  }

  function closePreview() {
    clearHoverTimer();
    clearCloseTimer();
    clearLoadTimer();

    if (state.activeRowEl) {
      state.activeRowEl.classList.remove('is-preview-active');
    }

    const restoreFocus = state.isPinned ? state.lastFocusedEl : null;
    state.activeTask = null;
    state.activeRowEl = null;
    state.lastFocusedEl = null;
    state.isPinned = false;
    state.iframeLoadedUrl = '';

    dom.popover.hidden = true;
    dom.popover.setAttribute('aria-hidden', 'true');
    dom.popover.classList.remove('is-mobile-drawer');
    dom.backdrop.hidden = true;
    dom.popoverLoading.hidden = true;

    dom.popoverIframe.dataset.targetUrl = '';
    dom.popoverIframe.src = 'about:blank';
    dom.popoverThumb.src = '';
    dom.popoverThumb.hidden = true;

    if (restoreFocus && restoreFocus.isConnected) {
      restoreFocus.focus();
    }
  }

  function bindGlobalEvents() {
    dom.popover.addEventListener('mouseenter', () => {
      clearCloseTimer();
    });

    dom.popover.addEventListener('mouseleave', () => {
      if (!state.isPinned) {
        scheduleClosePreview();
      }
    });

    dom.popoverClose.addEventListener('click', () => {
      closePreview();
    });

    dom.backdrop.addEventListener('click', () => {
      closePreview();
    });

    dom.popoverModeBtn.addEventListener('click', () => {
      if (!state.activeTask || !state.activeTask.thumbnail) return;
      const next = state.previewMode === 'thumb' ? 'iframe' : 'thumb';
      applyPreviewMode(state.activeTask, next);
    });

    dom.popoverIframe.addEventListener('load', () => {
      if (!state.activeTask) return;
      if (dom.popoverIframe.dataset.targetUrl !== state.activeTask.pagesUrl) return;
      clearLoadTimer();
      state.iframeLoadedUrl = state.activeTask.pagesUrl;
      setLoadingState(false, 'LIVE PREVIEW');
    });

    dom.popoverIframe.addEventListener('error', () => {
      if (!state.activeTask) return;
      clearLoadTimer();
      setLoadingState(false, 'EXT / VIEW');
    });

    dom.popoverThumb.addEventListener('load', () => {
      if (!state.activeTask || state.previewMode !== 'thumb') return;
      setLoadingState(false, 'SNAPSHOT');
    });

    dom.popoverThumb.addEventListener('error', () => {
      if (!state.activeTask || state.previewMode !== 'thumb') return;
      setLoadingState(false, 'IMG ERROR');
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !dom.popover.hidden) {
        closePreview();
      }
    });

    window.addEventListener('resize', () => {
      if (!dom.popover.hidden && state.activeTask) {
        updateIframeScale();
        positionPopover(state.activeRowEl);
      }
    });
  }

  function renderLoadError(error) {
    dom.repoTree.replaceChildren();
    const banner = createEl('div', 'status-banner status-banner--error');
    banner.appendChild(createEl('strong', '', 'GAGAL MEMUAT DATA/SHOWCASE.JS'));
    banner.appendChild(
      createEl(
        'p',
        '',
        `Detail error: ${error && error.message ? error.message : 'Unknown error'}`
      )
    );
    dom.repoTree.appendChild(banner);
  }

  function applyTheme(theme) {
    const normalized = theme === 'light' ? 'light' : 'dark';
    document.documentElement.dataset.theme = normalized;
    dom.themeButtons.forEach((btn) => {
      const isMatch = btn.dataset.themeValue === normalized;
      btn.classList.toggle('is-active', isMatch);
      btn.setAttribute('aria-pressed', String(isMatch));
    });
    try {
      localStorage.setItem(THEME_STORAGE_KEY, normalized);
    } catch {
      // Ignore storage failures under restricted file:// contexts
    }
  }

  function initTheme() {
    let initial = document.documentElement.dataset.theme || 'dark';
    try {
      const saved = localStorage.getItem(THEME_STORAGE_KEY);
      if (saved === 'light' || saved === 'dark') initial = saved;
    } catch {
      // Ignore storage failures
    }
    applyTheme(initial);

    dom.themeButtons.forEach((btn) => {
      btn.addEventListener('click', () => {
        applyTheme(btn.dataset.themeValue);
      });
    });
  }

  function init() {
    initTheme();
    bindGlobalEvents();
    try {
      const raw = window.SHOWCASE_DATA;
      if (!raw || typeof raw !== 'object') {
        throw new Error('window.SHOWCASE_DATA tidak ditemukan di data/showcase.js');
      }
      state.data = normalizeData(raw);
      renderGrid();
    } catch (err) {
      renderLoadError(err);
    }
  }

  init();
})();
