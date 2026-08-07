"use client";

import Link from "next/link";
import { GlassPanel } from "../../_design/GlassPanel";
import { Navigation } from "../../_design/Navigation";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { KeyboardEvent as ReactKeyboardEvent } from "react";
import styles from "./PlaceDetail.module.css";

type DetailSurface = "BOTTOM_SHEET" | "DETAIL_PANE" | "FULL_SCREEN";
type RestoreContext = Readonly<{ selection: string | null; scrollY: number; focusTarget: string | null }>;
type Snapshot = Readonly<{ areaName: string; availability: string; crowdLevel: string; populationMin: number | null; populationMax: number | null; sourceUpdatedAt: string | null; fetchedAt: string; freshness: string | null; freshnessBasis: string }>;
type ForecastPoint = Readonly<{ timestamp: string; crowdLevel: string; populationMin: number | null; populationMax: number | null; sourceUpdatedAt: string }>;
type HistoryProfile = Readonly<{ weekday: number; hour: number; maturity: string; crowdRankMedian: number | null; sampleCount: number; missingCount: number; coverage: number }>;
export type DetailPayload = Readonly<{ status: "READY" | "UNAVAILABLE" | "NOT_FOUND"; areaCode: string; areaName: string | null; snapshot: Snapshot | null; forecast: readonly ForecastPoint[]; history: readonly HistoryProfile[]; reason?: string }>;

const restoreKey = "seoul-gaja.detail.restore";
const safeAreaCode = /^[A-Za-z0-9_-]+$/;

function navigationType(): string { const entry = performance.getEntriesByType("navigation")[0]; return entry instanceof PerformanceNavigationTiming ? entry.type : "navigate"; }
function sheetSurface(): DetailSurface { return window.innerWidth >= 768 ? "DETAIL_PANE" : "BOTTOM_SHEET"; }
function currentSurface(): DetailSurface { return navigationType() !== "reload" && window.history.state?.entry === "sheet" ? sheetSurface() : "FULL_SCREEN"; }
function subscribeToSurface(onStoreChange: () => void): () => void { const onPopState = () => { restorePriorPlaceContext(); onStoreChange(); }; window.addEventListener("resize", onStoreChange); window.addEventListener("popstate", onPopState); return () => { window.removeEventListener("resize", onStoreChange); window.removeEventListener("popstate", onPopState); }; }
function dialogFocusableElements(container: HTMLElement): HTMLElement[] { return Array.from(container.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])')).filter((element) => element.tabIndex >= 0 && !element.hasAttribute("disabled")); }
function isRestoreContext(value: unknown): value is RestoreContext { if (typeof value !== "object" || value === null) return false; const selection = Reflect.get(value, "selection"); const scrollY = Reflect.get(value, "scrollY"); const focusTarget = Reflect.get(value, "focusTarget"); return (typeof selection === "string" || selection === null) && typeof scrollY === "number" && (typeof focusTarget === "string" || focusTarget === null); }
function readRestoreContext(): RestoreContext | null { const value = sessionStorage.getItem(restoreKey); if (value === null) return null; try { const parsed: unknown = JSON.parse(value); return isRestoreContext(parsed) ? parsed : null; } catch (error) { if (error instanceof SyntaxError) return null; throw error; } }
export function openInAppPlaceDetail(areaCode: string, restore: RestoreContext): void { const path = `/places/${encodeURIComponent(areaCode)}`; sessionStorage.setItem(restoreKey, JSON.stringify(restore)); window.history.pushState({ entry: "sheet" }, "", path); window.dispatchEvent(new CustomEvent("seoul-gaja:detail-selection", { detail: { areaCode, restore } })); }
export function restorePriorPlaceContext(): RestoreContext | null { const restore = readRestoreContext(); if (restore === null) return null; window.scrollTo({ top: restore.scrollY, behavior: "instant" }); if (restore.focusTarget !== null) requestAnimationFrame(() => document.getElementById(restore.focusTarget ?? "")?.focus()); window.dispatchEvent(new CustomEvent("seoul-gaja:detail-restored", { detail: restore })); return restore; }

function range(snapshot: Snapshot | null): string { if (snapshot === null || snapshot.populationMin === null || snapshot.populationMax === null) return "인구 범위 확인 불가"; return `${snapshot.populationMin.toLocaleString("ko-KR")}~${snapshot.populationMax.toLocaleString("ko-KR")}명`; }
function level(level: string): string { return { RELAXED: "여유", NORMAL: "보통", BUSY: "혼잡", CROWDED: "매우 혼잡", UNKNOWN: "정보 없음" }[level] ?? "정보 없음"; }
function source(snapshot: Snapshot): string { const value = snapshot.sourceUpdatedAt ?? snapshot.fetchedAt; const basis = snapshot.freshnessBasis === "fetched_at_degraded" ? "수집 시각 기준" : "원천 시각 기준"; return `${new Intl.DateTimeFormat("ko-KR", { dateStyle: "short", timeStyle: "short" }).format(new Date(value))} · ${basis}`; }
function chartPath(points: readonly ForecastPoint[]): string { if (points.length < 2) return ""; const values = points.map((point) => point.populationMax ?? point.populationMin ?? 0); const max = Math.max(...values, 1); return values.map((value, index) => `${index === 0 ? "M" : "L"}${(index / (values.length - 1)) * 100},${100 - (value / max) * 80}`).join(" "); }

export function PlaceDetailClient({ areaCode, payload }: Readonly<{ areaCode: string; payload: DetailPayload }>) {
  const isSafe = safeAreaCode.test(areaCode);
  const surface = useSyncExternalStore(subscribeToSurface, currentSurface, () => "FULL_SCREEN");
  const closeRef = useRef<HTMLButtonElement>(null);
  const [announcement, setAnnouncement] = useState("");
  useEffect(() => { const prior = document.activeElement instanceof HTMLElement ? document.activeElement : null; closeRef.current?.focus(); return () => { if (prior?.isConnected) prior.focus(); }; }, []);
  useEffect(() => { const onKey = (event: KeyboardEvent) => { if (event.key === "Escape" && currentSurface() !== "FULL_SCREEN") window.history.back(); }; window.addEventListener("keydown", onKey); return () => window.removeEventListener("keydown", onKey); }, []);
  function handleDialogKeyDown(event: ReactKeyboardEvent<HTMLElement>): void {
    if (event.key !== "Tab") return;
    const focusable = dialogFocusableElements(event.currentTarget);
    const first = focusable[0];
    const last = focusable.at(-1);
    if (first === undefined || last === undefined) return;
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  }
  if (!isSafe || payload.status === "NOT_FOUND") return <main className={styles.surface}><section className={styles.panel} aria-live="polite"><h1 className={styles.title}>공식 장소를 찾을 수 없습니다</h1><p className={styles.notice}>현재 공식 목록에서 사라진 장소입니다. 최신 카탈로그에서 다시 선택해 주세요.</p><Link className={styles.back} href="/">공식 장소 목록으로</Link></section></main>;
  const snapshot = payload.snapshot;
  const isUnavailable = payload.status !== "READY" || snapshot === null || snapshot.availability === "unavailable" || snapshot.availability === "expired";
  const forecast = isUnavailable ? [] : payload.forecast;
  const history = payload.history;
  const panelClass = surface === "FULL_SCREEN" ? styles.panel : `${styles.panel} ${styles.sheet}`;
  async function copyCanonicalUrl(url: string): Promise<boolean> {
    if (navigator.clipboard === undefined) return false;
    try {
      await navigator.clipboard.writeText(url);
      return true;
    } catch (error) {
      if (error instanceof DOMException) return false;
      throw error;
    }
  }
  async function share() {
    const url = new URL(`/places/${encodeURIComponent(areaCode)}`, window.location.origin).toString();
    if (navigator.share === undefined) {
      setAnnouncement(await copyCanonicalUrl(url) ? "공식 장소 링크를 복사했습니다." : "공유할 수 없습니다. 주소창의 공식 링크를 사용해 주세요.");
      return;
    }
    try {
      await navigator.share({ title: payload.areaName ?? "서울 공식 장소", url });
      setAnnouncement("공식 장소 링크를 공유했습니다.");
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        setAnnouncement("공유를 취소했습니다.");
        return;
      }
      setAnnouncement(await copyCanonicalUrl(url) ? "공유 대신 공식 장소 링크를 복사했습니다." : "공유할 수 없습니다. 주소창의 공식 링크를 사용해 주세요.");
    }
  }
  function closeDetail(): void {
    if (surface === "FULL_SCREEN") window.location.assign("/");
    else window.history.back();
  }
  return <main className={styles.surface} data-detail-surface={surface} data-area-code={areaCode} aria-live="polite"><section className={panelClass} role={surface === "FULL_SCREEN" ? undefined : "dialog"} aria-modal={surface === "FULL_SCREEN" ? undefined : true} aria-label={`${payload.areaName ?? areaCode} 상세`} onKeyDown={surface === "FULL_SCREEN" ? undefined : handleDialogKeyDown}>
    <header className={styles.header}><div><p className={styles.eyebrow}>OFFICIAL PLACE DETAIL</p><h1 className={styles.title}>{payload.areaName ?? areaCode}</h1><p className={styles.subtitle}>{snapshot === null ? "원천 데이터 연결 대기" : source(snapshot)}</p></div><button ref={closeRef} className={styles.close} type="button" onClick={closeDetail}>{surface === "FULL_SCREEN" ? "목록으로" : "닫기"}</button></header>
    <p className={styles.announcement} aria-live="polite">{announcement}</p>
    <GlassPanel depth="floating" className={styles.surfaceHint}>원천 데이터와 선택 상태를 공유하는 공식 장소 상세입니다.</GlassPanel>
    <section className={styles.statusCard} aria-label="현재 혼잡도"><div className={styles.statusLine}><span className={styles.badge} data-level={snapshot?.crowdLevel ?? "UNKNOWN"}>{level(snapshot?.crowdLevel ?? "UNKNOWN")}</span><span className={styles.caption}>{snapshot?.freshness ?? "확인 대기"}</span></div><p className={styles.range}>{range(snapshot)}</p><p className={styles.caption}>{snapshot?.availability === "carried_forward" ? "가장 최근에 확인된 관측을 표시합니다." : snapshot?.availability === "expired" ? "최근 데이터를 확인할 수 없습니다." : snapshot?.availability === "unavailable" ? "현재 혼잡 데이터가 없습니다." : "추정 범위 · 실제 현장과 차이가 있을 수 있습니다."}</p></section>
    <section className={styles.section} aria-label="추천 안내"><div className={styles.sectionHeader}><h2>가면 좋은 시간</h2><span className={styles.caption}>원천 기반만 표시</span></div><p className={styles.notice} data-tone="warning">{isUnavailable ? "현재 혼잡도 또는 공식 예측이 없어 추천을 보류합니다." : "충분한 공식 예측과 현재 혼잡 percentile이 연결되면 추천 이유와 시각을 표시합니다."}</p><p className={styles.caption}>{snapshot ? `현재 시각: ${source(snapshot)}` : "상태 확인 대기"}</p></section>
    <section className={styles.section} aria-label="공식 예측"><div className={styles.sectionHeader}><h2>공식 예측</h2><span className={styles.caption}>{forecast.length >= 6 ? `${forecast.length}개 시각` : "표시 조건 미충족"}</span></div>{forecast.length >= 6 ? <div className={styles.forecast}><svg className={styles.chart} viewBox="0 0 100 100" role="img" aria-label="공식 예측 범위 추이"><path d={chartPath(forecast)} /></svg><table className={styles.forecastTable}><caption className={styles.srOnly}>공식 미래 예측 시각과 인구 범위</caption><thead><tr><th scope="col">시각</th><th scope="col">범위</th><th scope="col">혼잡</th></tr></thead><tbody>{forecast.slice(0, 6).map((point) => <tr key={point.timestamp}><th scope="row">{new Intl.DateTimeFormat("ko-KR", { hour: "2-digit", minute: "2-digit" }).format(new Date(point.timestamp))}</th><td>{point.populationMin === null || point.populationMax === null ? "확인 불가" : `${point.populationMin.toLocaleString("ko-KR")}~${point.populationMax.toLocaleString("ko-KR")}`}</td><td>{level(point.crowdLevel)}</td></tr>)}</tbody></table></div> : <p className={styles.notice}>{isUnavailable ? "최근 데이터가 만료되었거나 원천 예측을 불러오지 못했습니다." : "공식 미래 시각이 6개 이상 모이면 차트가 표시됩니다."}</p>}</section>
    <section className={styles.section} aria-label="생활 정보"><h2>주변 생활 정보</h2><dl className={styles.metricGrid}>{["주차", "따릉이", "사고", "행사"].map((label) => <div key={label} className={styles.metric}><dt>{label}</dt><dd>연결 대기</dd></div>)}</dl></section>
    <div className={styles.actions}><a className={styles.mapLink} href={`https://map.kakao.com/?q=${encodeURIComponent(payload.areaName ?? areaCode)}`} target="_blank" rel="noreferrer">카카오맵</a><a className={styles.mapLink} href={`https://map.naver.com/p/search/${encodeURIComponent(payload.areaName ?? areaCode)}`} target="_blank" rel="noreferrer">네이버지도</a><button className={styles.share} type="button" onClick={share}>가족과 공유</button><Link className={styles.back} href="/">목록으로 돌아가기</Link></div><p className={styles.caption}>이 링크는 공식 장소만 식별하며 현재 위치를 포함하지 않습니다.</p>
    <section className={styles.section} aria-label="히스토리 인사이트"><div className={styles.sectionHeader}><h2>히스토리 인사이트</h2><span className={styles.caption}>{history[0]?.maturity ?? "UNAVAILABLE"}</span></div>{history.length === 0 ? <p className={styles.notice}>데이터가 축적되면 요일×시간 패턴을 표시합니다. 결측값은 0으로 대체하지 않습니다.</p> : <><p className={styles.caption}>공식 관측 패턴 · 유효 샘플 {history.reduce((sum, row) => sum + row.sampleCount, 0).toLocaleString("ko-KR")}개</p><div className={styles.heatmap} aria-label="요일별 히스토리 패턴">{history.slice(0, 28).map((row, index) => <div key={`${row.weekday}-${row.hour}-${index}`}><span className={styles.cell} data-missing={row.crowdRankMedian === null} title={`${row.weekday}요일 ${row.hour}시`} /><span className={styles.cellLabel}>{row.crowdRankMedian === null ? "—" : `${row.hour}시`}</span></div>)}</div></>}</section>
  </section><Navigation activeId="map" items={[{ id: "map", label: "지도" }, { id: "list", label: "목록" }]} label="주요 화면" onSelect={(item) => { if (item.id === "list") window.location.assign("/"); }} /></main>;
}
