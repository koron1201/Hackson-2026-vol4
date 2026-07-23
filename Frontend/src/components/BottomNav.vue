<template>
  <nav class="bottom-nav" aria-label="メインナビゲーション">
    <RouterLink to="/home">
      <span aria-hidden="true">⌂</span>
      <small>ホーム</small>
    </RouterLink>
    <RouterLink to="/tasks">
      <span aria-hidden="true">☷</span>
      <small>クエスト</small>
    </RouterLink>
    <RouterLink to="/battle">
      <span aria-hidden="true">⚔</span>
      <small>バトル</small>
    </RouterLink>
    <RouterLink to="/plan">
      <span aria-hidden="true">✎</span>
      <small>計画</small>
    </RouterLink>
  </nav>
</template>
