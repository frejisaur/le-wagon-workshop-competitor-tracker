'use client';

export function SkipLink() {
  function focusMainContent() {
    document.getElementById('main-content')?.focus();
  }

  return <a className="skip-link" href="#main-content" onClick={focusMainContent}>Skip to content</a>;
}
