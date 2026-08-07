"use client";

import { useEffect } from "react";

import styles from "./PlaceDetail.module.css";

const catalogNotFoundPath = "/?placeNotFound=1";

export function InvalidPlaceFallback() {
  useEffect(() => {
    window.location.replace(catalogNotFoundPath);
  }, []);

  return (
    <main className={styles.surface} data-invalid-place-fallback>
      <section className={styles.panel} aria-live="polite">
        <h1 className={styles.title}>공식 장소를 찾을 수 없습니다</h1>
        <p className={styles.notice}>현재 공식 목록에서 사라진 장소입니다. 최신 카탈로그로 돌아갑니다.</p>
        <a className={styles.back} href={catalogNotFoundPath}>공식 장소 목록으로</a>
      </section>
    </main>
  );
}
