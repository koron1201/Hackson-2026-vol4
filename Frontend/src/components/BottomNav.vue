<template>
  <nav class="bottom-nav" aria-label="メインナビゲーション">
    <RouterLink to="/home">
      <span class="bottom-nav__icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" focusable="false">
          <path d="m3 10.5 9-7.5 9 7.5" />
          <path d="M5.5 9.5V21h13V9.5M9.5 21v-6h5v6" />
        </svg>
      </span>
      <small>ホーム</small>
    </RouterLink>
    <RouterLink to="/tasks">
      <span class="bottom-nav__icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" focusable="false">
          <rect x="4" y="3" width="16" height="18" rx="3" />
          <path d="M8 8h8M8 12h8M8 16h5" />
        </svg>
      </span>
      <small>クエスト</small>
    </RouterLink>
    <RouterLink to="/battle">
      <span class="bottom-nav__icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" focusable="false">
          <path d="m4 3 8 8-3 3-8-8V3h3ZM9 14l-5 5M2.5 20.5l3-3" />
          <path d="m20 3-8 8 3 3 8-8V3h-3ZM15 14l5 5m1.5 1.5-3-3" />
        </svg>
      </span>
      <small>バトル</small>
    </RouterLink>
    <RouterLink to="/plan">
      <span class="bottom-nav__icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" focusable="false">
          <rect x="3" y="5" width="18" height="16" rx="3" />
          <path d="M8 3v4m8-4v4M3 10h18m-13 5 2.2 2.2L16 12" />
        </svg>
      </span>
      <small>計画</small>
    </RouterLink>
  </nav>
</template>
