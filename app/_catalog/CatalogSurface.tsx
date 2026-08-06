"use client";

import { useEffect, useMemo, useState } from "react";
import { openInAppPlaceDetail } from "../places/[areaCode]/PlaceDetailClient";
import styles from "./CatalogSurface.module.css";

export type CatalogRow = Readonly<{
  areaCode: string;
  areaName: string;
  availability: string;
  crowdLevel: string;
  populationMin: number | null;
  populationMax: number | null;
  sourceUpdatedAt: string | null;
  fetchedAt: string;
  freshness: string | null;
  freshnessBasis: string;
}>;

export type RecommendationSummary = Readonly<{
  mode: "NOW" | "NEXT";
  status: "READY" | "ZERO_ELIGIBLE";
  browseCopy?: string;
}>;

export type CatalogSurfaceProps = Readonly<{
  status: "READY" | "UNAVAILABLE";
  catalog: readonly CatalogRow[];
  snapshotStatus: "READY" | "PARTIAL" | "UNAVAILABLE";
  sourceTime: string | null;
  recommendations: Readonly<{ now: RecommendationSummary; next: RecommendationSummary }>;
  unavailableReason?: string;
}>;

const purposes = [
  { id: "family", label: "아이와 나들이", description: "걷기 편하고 여유로운 곳" },
  { id: "date", label: "데이트", description: "분위기와 발견이 있는 곳" },
  { id: "hot", label: "지금 핫플", description: "지금 가장 생생한 거리" },
] as const;

function displayRange(row: CatalogRow): string {
  if (row.populationMin === null || row.populationMax === null) return "인구 범위 확인 불가";
  return `${row.populationMin.toLocaleString("ko-KR")}~${row.populationMax.toLocaleString("ko-KR")}명`;
}

function displayLevel(level: string): string {
  return { RELAXED: "여유", NORMAL: "보통", BUSY: "혼잡", CROWDED: "매우 혼잡", UNKNOWN: "정보 없음" }[level] ?? "정보 없음";
}

function displaySource(row: CatalogRow): string {
  const value = row.sourceUpdatedAt ?? row.fetchedAt;
  const basis = row.freshnessBasis === "fetched_at_degraded" ? "수집 시각 기준" : "원천 시각 기준";
  return `${new Intl.DateTimeFormat("ko-KR", { hour: "2-digit", minute: "2-digit" }).format(new Date(value))} · ${basis}`;
}

function eventSelection(event: Event): string | null {
  if (!(event instanceof CustomEvent)) return null;
  const detail: unknown = event.detail;
  if (typeof detail !== "object" || detail === null) return null;
  const selection = Reflect.get(detail, "areaCode") ?? Reflect.get(detail, "selection");
  return typeof selection === "string" ? selection : null;
}

export function CatalogSurface({ status, catalog, snapshotStatus, sourceTime, recommendations, unavailableReason }: CatalogSurfaceProps) {
  const [query, setQuery] = useState("");
  const [purpose, setPurpose] = useState<(typeof purposes)[number]["id"]>("family");
  const [selectedAreaCode, setSelectedAreaCode] = useState<string | null>(null);
  const [geoState, setGeoState] = useState<"idle" | "denied" | "timeout">("idle");
  const [mapRetry, setMapRetry] = useState(0);
  useEffect(() => {
    const onSelection = (event: Event) => setSelectedAreaCode(eventSelection(event));
    window.addEventListener("seoul-gaja:detail-selection", onSelection);
    window.addEventListener("seoul-gaja:detail-restored", onSelection);
    return () => {
      window.removeEventListener("seoul-gaja:detail-selection", onSelection);
      window.removeEventListener("seoul-gaja:detail-restored", onSelection);
    };
  }, []);
  const filtered = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("ko-KR");
    return normalized.length === 0 ? catalog : catalog.filter((row) => row.areaName.toLocaleLowerCase("ko-KR").includes(normalized));
  }, [catalog, query]);

  function requestLocation() {
    if (!navigator.geolocation) { setGeoState("denied"); return; }
    navigator.geolocation.getCurrentPosition(() => setGeoState("idle"), (error) => setGeoState(error.code === 3 ? "timeout" : "denied"), { timeout: 5000, maximumAge: 300000 });
  }

  function openPlace(row: CatalogRow) {
    setSelectedAreaCode(row.areaCode);
    openInAppPlaceDetail(row.areaCode, { selection: row.areaCode, scrollY: window.scrollY, focusTarget: `place-${row.areaCode}` });
  }

  return (
    <main className={styles.surface}>
      <div className={styles.shell}>
        <section className={styles.explorer} aria-label="서울 공식 장소 탐색">
          <header>
            <p className={styles.eyebrow}>SEOUL / LIVE CITY PULSE</p>
            <h1 className={styles.title}>오늘, 어디가<br /><span>편안할까요?</span></h1>
            <p className={styles.subtitle}>서울 곳곳의 혼잡도와 공식 예측을 한눈에 보고 가족의 다음 시간을 천천히 고르세요.</p>
          </header>
          <label className={styles.search} htmlFor="place-search">
            <span className={styles.searchIcon} aria-hidden="true">⌕</span>
            <span className={styles.srOnly}>공식 장소 검색</span>
            <input id="place-search" className={styles.searchInput} value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => { if (event.key === "Escape") setQuery(""); }} placeholder="명소나 동네를 찾아보세요" />
            {query.length > 0 && <button className={styles.clearButton} type="button" aria-label="검색어 지우기" onClick={() => setQuery("")}>×</button>}
          </label>
          <div className={styles.chipRow} role="group" aria-label="오늘의 목적">
            {purposes.map((item) => <button key={item.id} className={styles.chip} data-selected={purpose === item.id} aria-pressed={purpose === item.id} type="button" onClick={() => setPurpose(item.id)}>{item.label}</button>)}
          </div>
          <section className={styles.statusBanner} aria-live="polite">
            <div className={styles.statusLine}><span className={styles.statusPill} data-state={status === "READY" ? "READY" : "UNAVAILABLE"}><span className={styles.statusDot} aria-hidden="true" />{status === "READY" ? (snapshotStatus === "PARTIAL" ? "일부 공식 데이터" : "서울 전체 분위기") : "공식 데이터 연결 대기"}</span><strong>{status === "READY" ? `${catalog.length}곳 확인` : "확인 필요"}</strong></div>
            <p className={styles.caption}>{sourceTime ? `${displaySource({ sourceUpdatedAt: sourceTime, fetchedAt: sourceTime, freshnessBasis: "source_updated_at" } as CatalogRow)}` : unavailableReason ?? "D1 연결 후 공식 장소 목록이 표시됩니다."}</p>
          </section>
          <div className={styles.listHeader}><h2 className={styles.sectionTitle}>{purposes.find((item) => item.id === purpose)?.label} 추천 장소</h2><p className={styles.caption}>{filtered.length}곳</p></div>
          <div className={styles.placeList} aria-label="공식 장소 목록">
            {status === "UNAVAILABLE" && <p className={styles.empty}>현재 데이터 연결이 지연되고 있습니다.<br />지도와 목록은 연결 후 자동으로 갱신됩니다.</p>}
            {status === "READY" && filtered.length === 0 && <p className={styles.empty}>검색 결과가 없습니다. 다른 공식 장소명을 입력해 보세요.</p>}
            {status === "READY" && filtered.map((row) => <button key={row.areaCode} id={`place-${row.areaCode}`} className={styles.placeButton} data-selected={selectedAreaCode === row.areaCode} type="button" onClick={() => openPlace(row)} aria-current={selectedAreaCode === row.areaCode ? "true" : undefined} aria-label={`${row.areaName} 상세 보기`}>
              <span className={styles.placeName}>{row.areaName}</span><span className={styles.placeLevel} data-level={row.crowdLevel}>{displayLevel(row.crowdLevel)}</span>
              <span className={row.availability === "unavailable" ? styles.placeUnavailable : styles.placeRange}>{row.availability === "unavailable" ? "최근 데이터 확인 불가" : displayRange(row)}</span><span className={styles.placeMeta}>{displaySource(row)}</span>
            </button>)}
          </div>
        </section>
        <section className={styles.main} aria-label="서울 지도와 추천">
          <div className={styles.mapPane} aria-label="서울 한눈에 보기">
            <div className={styles.mapGrid} aria-hidden="true" />
            <div className={styles.mapContent}>
              <div className={styles.mapHeading}><div><p className={styles.eyebrow}>LIVE MAP</p><h2>서울 한눈에 보기</h2><p>공식 장소 목록과 같은 선택 상태를 공유합니다.</p></div><span className={styles.caption}>실제 데이터 연결 전 미리보기</span></div>
              <div className={styles.mapNotice} role="status"><strong>지도를 불러오지 못했습니다</strong><p>목록과 장소 상세는 유지됩니다. 연결이 되면 {mapRetry > 0 ? "다시 시도했습니다." : "자동으로 갱신됩니다."}</p><div className={styles.mapActions}><button className={styles.retryButton} type="button" onClick={() => setMapRetry((value) => value + 1)}>다시 시도</button><button className={styles.geoButton} type="button" onClick={requestLocation}>내 주변</button></div>{geoState !== "idle" && <p className={styles.source}>{geoState === "timeout" ? "위치 요청 시간이 초과되었습니다." : "위치 권한이 없어 공식 목록으로 계속합니다."}</p>}</div>
            </div>
          </div>
          <div className={styles.recommendations} aria-label="가족 시간 추천">
            {[recommendations.now, recommendations.next].map((item) => <article key={item.mode} className={styles.recommendation}><h2>{item.mode === "NOW" ? "지금 가면 좋은 시간" : "다음이 더 편안한 시간"}</h2><p>현재 혼잡도와 공식 미래 시각을 함께 확인합니다.</p><div className={styles.recommendationStatus}>{item.status === "READY" ? "추천 결과가 준비되었습니다" : "추천 보류"}</div><p className={styles.recommendationReason}>{item.browseCopy ?? "원천 데이터가 충분해지면 추천 이유와 시각을 표시합니다."}</p></article>)}
          </div>
        </section>
      </div>
    </main>
  );
}
