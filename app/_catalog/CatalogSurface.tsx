"use client";

import { GlassPanel } from "../_design/GlassPanel";
import { ChartAlternatives } from "../_design/ChartAlternatives";
import { Navigation } from "../_design/Navigation";
import { PlaceDetailSheet } from "../_design/PlaceDetailSheet";
import { useEffect, useMemo, useState } from "react";
import { closeInAppPlaceDetail, ensureCatalogHistorySentinel, isCatalogHistorySentinel, openInAppPlaceDetail, restorePriorPlaceContext } from "../places/[areaCode]/PlaceDetailClient";
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
  results: readonly Readonly<{
    areaCode: string;
    variant: "base" | "history-enhanced";
    historyMaturity: "ACCUMULATING" | "PROVISIONAL" | "STABLE" | "MATURE";
    selectedTimestamp: string;
    sourceTimestamps: Readonly<Record<string, string>>;
    reasons: readonly Readonly<{
      kind: "current_crowd_percentile" | "official_forecast_percentile" | "history_deviation_percentile";
      sourceTimestamp: string;
    }>[];
  }>[];
}>;

export type CatalogSurfaceProps = Readonly<{
  status: "READY" | "UNAVAILABLE";
  catalog: readonly CatalogRow[];
  snapshotStatus: "READY" | "PARTIAL" | "UNAVAILABLE";
  sourceTime: string | null;
  recommendations: Readonly<{ now: RecommendationSummary; next: RecommendationSummary }>;
  unavailableReason?: string;
  initialSelectedAreaCode?: string;
  placeNotFound?: boolean;
}>;

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

function displayRecommendationTime(timestamp: string): string {
  return new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(timestamp));
}

function reasonLabel(kind: RecommendationSummary["results"][number]["reasons"][number]["kind"]): string {
  if (kind === "current_crowd_percentile") return "같은 시각의 현재 혼잡도 비교";
  if (kind === "official_forecast_percentile") return "같은 예보 구간의 공식 혼잡도 비교";
  return "같은 요일·30분 구간의 과거 편차";
}

function eventSelection(event: Event): string | null {
  if (!(event instanceof CustomEvent)) return null;
  const detail: unknown = event.detail;
  if (typeof detail !== "object" || detail === null) return null;
  const selection = Reflect.get(detail, "areaCode") ?? Reflect.get(detail, "selection");
  return typeof selection === "string" ? selection : null;
}

export function CatalogSurface({ status, catalog, snapshotStatus, sourceTime, recommendations, unavailableReason, initialSelectedAreaCode, placeNotFound = false }: CatalogSurfaceProps) {
  const [query, setQuery] = useState("");
  const [selectedAreaCode, setSelectedAreaCode] = useState<string | null>(initialSelectedAreaCode ?? null);
  const [sheetOpen, setSheetOpen] = useState(initialSelectedAreaCode !== undefined);
  const [compactDetail, setCompactDetail] = useState(true);
  const [detailSurface, setDetailSurface] = useState<"BOTTOM_SHEET" | "DETAIL_PANE">("BOTTOM_SHEET");
  const [expanded, setExpanded] = useState(false);
  const [availableOnly, setAvailableOnly] = useState(false);
  const [geoState, setGeoState] = useState<"idle" | "denied" | "timeout">("idle");
  const [mapRetry, setMapRetry] = useState(0);
  const [activeNavigationId, setActiveNavigationId] = useState("map");
  useEffect(() => {
    const onSelection = (event: Event) => setSelectedAreaCode(eventSelection(event));
    const onHistoryRestore = () => {
      const restore = restorePriorPlaceContext();
      setSelectedAreaCode(restore?.selection ?? null);
      setSheetOpen(false);
      setExpanded(false);
    };
    const onCatalogReplay = (event: PopStateEvent) => {
      if (!isCatalogHistorySentinel(event.state)) return;
      event.stopImmediatePropagation();
      onHistoryRestore();
    };
    ensureCatalogHistorySentinel();
    window.addEventListener("seoul-gaja:detail-selection", onSelection);
    window.addEventListener("popstate", onCatalogReplay, true);
    window.addEventListener("popstate", onHistoryRestore);
    window.addEventListener("seoul-gaja:detail-close", onHistoryRestore);
    return () => {
      window.removeEventListener("seoul-gaja:detail-selection", onSelection);
      window.removeEventListener("popstate", onCatalogReplay, true);
      window.removeEventListener("popstate", onHistoryRestore);
      window.removeEventListener("seoul-gaja:detail-close", onHistoryRestore);
    };
  }, []);
  useEffect(() => {
    const media = window.matchMedia("(max-width: 1460px)");
    const update = () => {
      setCompactDetail(media.matches);
      setDetailSurface(window.innerWidth >= 768 ? "DETAIL_PANE" : "BOTTOM_SHEET");
    };
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  useEffect(() => {
    if (!placeNotFound) return;
    window.history.replaceState(null, "", "/");
  }, [placeNotFound]);
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && sheetOpen && !compactDetail) closeInAppPlaceDetail();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [compactDetail, sheetOpen]);
  const filtered = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("ko-KR");
    return catalog.filter((row) => (!availableOnly || row.availability !== "unavailable") && (normalized.length === 0 || row.areaName.toLocaleLowerCase("ko-KR").includes(normalized)));
  }, [availableOnly, catalog, query]);
  const selectedRow = useMemo(() => catalog.find((row) => row.areaCode === selectedAreaCode) ?? filtered[0] ?? null, [catalog, filtered, selectedAreaCode]);

  function requestLocation() {
    if (!navigator.geolocation) { setGeoState("denied"); return; }
    navigator.geolocation.getCurrentPosition(() => setGeoState("idle"), (error) => setGeoState(error.code === 3 ? "timeout" : "denied"), { timeout: 5000, maximumAge: 300000 });
  }

  function openPlace(row: CatalogRow) {
    const priorSelection = selectedAreaCode;
    setSelectedAreaCode(row.areaCode);
    setSheetOpen(true);
    openInAppPlaceDetail(row.areaCode, { selection: priorSelection, scrollY: window.scrollY, focusTarget: `place-${row.areaCode}` });
  }

  function closePlace() {
    closeInAppPlaceDetail();
  }

  return (
    <main className={styles.surface}>
      <div className={styles.shell}>
        <section className={styles.explorer} aria-label="서울 공식 장소 탐색">
          {placeNotFound && <GlassPanel depth="floating" data-catalog-not-found role="status" aria-live="polite">
            <strong>선택한 공식 장소를 더 이상 찾을 수 없습니다.</strong>
            <p>현재 공식 카탈로그에서 다른 장소를 선택해 주세요.</p>
          </GlassPanel>}
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
          <p className={styles.srOnly} aria-live="polite">{filtered.length === 0 ? "공식 장소 검색 결과가 없습니다. 검색어를 지우면 전체 목록을 볼 수 있습니다." : `공식 장소 ${filtered.length}곳을 표시합니다.`} {geoState === "denied" ? "위치 권한이 없어 공식 목록으로 계속합니다." : geoState === "timeout" ? "위치 요청 시간이 초과되었습니다. 내 주변 다시 시도를 선택하세요." : ""}</p>
          <GlassPanel depth="floating" className={styles.statusBanner} aria-live="polite">
            <div className={styles.statusLine}><span className={styles.statusPill} data-state={status === "READY" ? "READY" : "UNAVAILABLE"}><span className={styles.statusDot} aria-hidden="true" />{status === "READY" ? (snapshotStatus === "PARTIAL" ? "일부 공식 데이터" : "서울 전체 분위기") : "공식 데이터 연결 대기"}</span><strong>{status === "READY" ? `${catalog.length}곳 확인` : "확인 필요"}</strong></div>
            <div className={styles.chipRow} aria-label="공식 장소 필터와 위치 도구">
              <button className={styles.chip} data-selected={availableOnly} type="button" onClick={() => setAvailableOnly((value) => !value)}>데이터 있는 곳</button>
              <button className={styles.chip} type="button" onClick={requestLocation}>{geoState === "timeout" ? "내 주변 다시 시도" : "내 주변"}</button>
              <a aria-label="주소 검색은 외부 지도에서 열기" className={styles.externalMap} href={`https://map.kakao.com/?q=${encodeURIComponent(query.trim() || "서울")}`} target="_blank" rel="noreferrer">주소 검색</a>
            </div>
            <p className={styles.caption}>{sourceTime ? `${displaySource({ sourceUpdatedAt: sourceTime, fetchedAt: sourceTime, freshnessBasis: "source_updated_at" } as CatalogRow)}` : unavailableReason ?? "D1 연결 후 공식 장소 목록이 표시됩니다."}</p>
          </GlassPanel>
          <div className={styles.listHeader}><h2 className={styles.sectionTitle}>공식 장소 둘러보기</h2><p className={styles.caption}>{filtered.length}곳</p></div>
          <div id="catalog-list" className={styles.placeList} aria-label="공식 장소 목록">
            {status === "UNAVAILABLE" && <p className={styles.empty}>현재 데이터 연결이 지연되고 있습니다.<br />지도와 목록은 연결 후 자동으로 갱신됩니다.</p>}
            {status === "READY" && filtered.length === 0 && <p className={styles.empty}>공식 장소 검색 결과가 없습니다. <button className={styles.clearButton} type="button" onClick={() => { setQuery(""); setAvailableOnly(false); }}>검색과 필터 지우기</button></p>}
            {status === "READY" && filtered.map((row) => <button key={row.areaCode} id={`place-${row.areaCode}`} className={styles.placeButton} data-selected={selectedAreaCode === row.areaCode} type="button" onClick={() => openPlace(row)} aria-current={selectedAreaCode === row.areaCode ? "true" : undefined} aria-label={`${row.areaName} 상세 보기`}>
              <span className={styles.placeName}>{row.areaName}</span><span className={styles.placeLevel} data-level={row.crowdLevel}>{displayLevel(row.crowdLevel)}</span>
              <span className={row.availability === "unavailable" ? styles.placeUnavailable : styles.placeRange}>{row.availability === "unavailable" ? "최근 데이터 확인 불가" : displayRange(row)}</span><span className={styles.placeMeta}>{displaySource(row)}</span>
            </button>)}
          </div>
        </section>
        <section className={styles.main} aria-label="서울 지도와 추천" data-selected-area-code={selectedRow?.areaCode ?? "none"}>
          <GlassPanel depth="content" className={styles.mapPane} aria-label="서울 한눈에 보기">
            <div className={styles.mapGrid} aria-hidden="true" />
            {status === "READY" && <div className={styles.mapMarkers} aria-label="지도 장소 표식">
              {catalog.slice(0, 6).map((row, index) => <button key={row.areaCode} className={styles.mapMarker} data-index={index} data-level={row.crowdLevel} data-selected={selectedRow?.areaCode === row.areaCode} type="button" onClick={() => openPlace(row)} aria-label={`${row.areaName} 지도 표식 선택`}><span aria-hidden="true" /></button>)}
            </div>}
            <div className={styles.mapContent}>
              <div className={styles.mapHeading}><div><p className={styles.eyebrow}>LIVE MAP</p><h2>서울 한눈에 보기</h2><p>공식 장소 목록과 같은 선택 상태를 공유합니다.</p></div><span className={styles.caption}>실제 데이터 연결 전 미리보기</span></div>
              {status === "UNAVAILABLE" ? <div className={styles.mapNotice} role="status"><strong>지도를 불러오지 못했습니다</strong><p>목록과 장소 상세는 유지됩니다. 연결이 되면 {mapRetry > 0 ? "다시 시도했습니다." : "자동으로 갱신됩니다."}</p><div className={styles.mapActions}><button className={styles.retryButton} type="button" onClick={() => setMapRetry((value) => value + 1)}>다시 시도</button><button className={styles.geoButton} type="button" onClick={requestLocation}>내 주변</button><a className={styles.externalMap} href="https://map.kakao.com/?q=서울" target="_blank" rel="noreferrer">카카오 지도</a></div>{geoState !== "idle" && <p className={styles.source}>{geoState === "timeout" ? "위치 요청 시간이 초과되었습니다." : "위치 권한이 없어 공식 목록으로 계속합니다."}</p>}</div> : <div className={styles.mapLegend} aria-label="혼잡도 범례"><span data-level="RELAXED">여유</span><span data-level="NORMAL">보통</span><span data-level="BUSY">약간 붐빔</span></div>}
            </div>
          </GlassPanel>
          <div className={`${styles.recommendations} sg-recommendations`} aria-label="공식 혼잡도 기반 시간 안내" aria-live="polite">
            {[recommendations.now, recommendations.next].map((item) => {
              const result = item.results[0];
              const recommendedRow = result ? catalog.find((place) => place.areaCode === result.areaCode) : undefined;
              const chartRows = result?.reasons.slice(0, 3).map((reason) => ({
                label: reasonLabel(reason.kind),
                value: displayRecommendationTime(reason.sourceTimestamp),
              })) ?? [];
              return <GlassPanel depth="content" key={item.mode} className={`${styles.recommendation} sg-recommendation`}>
                <h2>{item.mode}</h2>
                {item.status === "READY" && result ? <>
                  <p className={styles.recommendationStatus}>{result.variant === "history-enhanced" ? `${result.historyMaturity} · 과거 패턴 포함` : "기본 · 현재와 공식 예보"}</p>
                  <p><strong>{recommendedRow?.areaName ?? result.areaCode}</strong> · <time dateTime={result.selectedTimestamp}>{displayRecommendationTime(result.selectedTimestamp)}</time></p>
                  <ChartAlternatives
                    emptyMessage="추천을 설명할 원천 시각이 없습니다."
                    rows={chartRows}
                    summary="추천에 사용된 원천별 기준 시각입니다. 수치 점수는 표시하지 않습니다."
                    title={`${item.mode} 추천 근거`}
                  />
                  {recommendedRow && <button className={`${styles.detailAction}${item.mode === "NOW" ? " sg-current-decision-cta" : ""}`} data-current-decision={item.mode === "NOW" ? "true" : undefined} type="button" onClick={() => openPlace(recommendedRow)}>추천 장소 자세히 보기</button>}
                </> : <ChartAlternatives
                  emptyMessage={item.browseCopy ?? "필수 원천값이 없어 추천을 보류합니다. 장소 목록은 계속 둘러볼 수 있습니다."}
                  rows={[]}
                  summary="표시할 수 있는 원천 기반 추천이 없습니다."
                  title={`${item.mode} 추천 근거`}
                />}
              </GlassPanel>;
            })}
          </div>
        </section>
        <GlassPanel depth="strong" className={styles.detailPane} aria-label="선택한 장소 상세" data-detail-surface={sheetOpen && !compactDetail ? "DETAIL_PANE" : undefined}>
          <div className={styles.detailPaneHeader}><div><p className={styles.eyebrow}>PLACE DETAIL</p><h2>{selectedRow?.areaName ?? "장소를 선택하세요"}</h2></div>{selectedAreaCode ? <button aria-label="상세 닫기" className={styles.clearButton} type="button" onClick={closePlace}>닫기</button> : selectedRow && <span className={styles.placeLevel} data-level={selectedRow.crowdLevel}>{displayLevel(selectedRow.crowdLevel)}</span>}</div>
          <div className={styles.detailStatusCard}><span className={styles.badge} data-level={selectedRow?.crowdLevel ?? "UNKNOWN"}>{selectedRow ? displayLevel(selectedRow.crowdLevel) : "정보 없음"}</span><strong>{selectedRow ? displayRange(selectedRow) : "인구 범위 확인 불가"}</strong><p className={styles.caption}>{selectedRow ? displaySource(selectedRow) : "공식 데이터가 연결되면 선택한 장소의 혼잡도와 예측을 표시합니다."}</p></div>
          <div className={styles.detailMeta}><span>공식 예측</span><strong>연결 대기</strong><span>히스토리 인사이트</span><strong>UNAVAILABLE</strong></div>
          {selectedRow && <button className={styles.detailAction} type="button" onClick={() => openPlace(selectedRow)}>상세 열기</button>}
        </GlassPanel>
      </div>
      {sheetOpen && compactDetail && selectedRow && <PlaceDetailSheet label={`${selectedRow.areaName} 상세`} onRequestClose={closePlace} surface={detailSurface}>
        <div className={styles.detailPaneHeader}><div><p className={styles.eyebrow}>OFFICIAL PLACE DETAIL</p><h2>{selectedRow.areaName}</h2></div><span className={styles.placeLevel} data-level={selectedRow.crowdLevel}>{displayLevel(selectedRow.crowdLevel)}</span></div>
        <div className={styles.detailStatusCard}><strong>{displayRange(selectedRow)}</strong><p className={styles.caption}>{displaySource(selectedRow)}</p></div>
        <p className={styles.caption}>{selectedRow.availability === "expired" ? "최근 데이터가 만료되어 공식 예보와 다음 시간 안내를 숨깁니다." : selectedRow.availability === "unavailable" ? "현재 혼잡 데이터를 확인할 수 없습니다." : "공식 장소 링크에는 현재 위치가 포함되지 않습니다."}</p>
        <button className={styles.detailAction} type="button" aria-expanded={expanded} onClick={() => setExpanded((value) => !value)}>{expanded ? "간단히 보기" : "상세 정보 펼치기"}</button>
        {expanded && <div className={styles.detailMeta}><span>공식 예보</span><strong>{selectedRow.availability === "available" ? "원천 데이터 기준" : "사용 불가"}</strong><span>히스토리</span><strong>축적 상태 확인</strong></div>}
        <a className={styles.externalMap} href={`/places/${encodeURIComponent(selectedRow.areaCode)}`}>공유 가능한 전체 화면 링크</a>
      </PlaceDetailSheet>}
      <Navigation activeId={activeNavigationId} items={[{ id: "map", label: "지도" }, { id: "list", label: "목록" }]} label="주요 화면" onSelect={(item) => { setActiveNavigationId(item.id); if (item.id === "list") document.getElementById("catalog-list")?.scrollIntoView({ behavior: "smooth", block: "start" }); }} />
    </main>
  );
}
