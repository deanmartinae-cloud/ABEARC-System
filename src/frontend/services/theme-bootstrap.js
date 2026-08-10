    // CRITICAL: Apply theme BEFORE any UI renders to prevent flash
    (function applyThemeImmediately() {
      try {
        const hasAuthToken = !!localStorage.getItem('abedAuthToken');
        const cached = localStorage.getItem('abedTheme');
        if (hasAuthToken && cached) {
          applyTheme(cached);
        } else {
          // Login/unauthenticated screens must always render in light mode.
          applyTheme('light');
        }
      } catch(e) {}
      
      function applyTheme(theme) {
        const html = document.documentElement;
        if (theme === 'dark') {
          html.classList.add('dark');
        } else if (theme === 'system') {
          if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
            html.classList.add('dark');
          } else {
            html.classList.remove('dark');
          }
        } else {
          html.classList.remove('dark');
        }
      }
    })();
