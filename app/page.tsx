"use client";

import { useMemo, useState } from "react";

type Level = "여유" | "보통" | "약간 붐빔" | "붐빔";
type Preset = "아이와 나들이" | "데이트" | "지금 핫플";
type SortMode = "추천순" | "여유순" | "붐빔순";

type Place = {
  id: string;
  name: string;
  district: string;
  level: Level;
  population: [number, number];
  updatedAt: string;
  category: string;
  description: string;
  position: { top: number; left: number };
  forecast: { time: string; level: Level; value: number }[];
  scores: Record<Preset, number>;
  tags: string[];
};

const places: Place[] = [
  {
    id: "gwanghwamun",
    name: "광화문·덕수궁",
    district: "종로구",
    level: "약간 붐빔",
    population: [8200, 9700],
    updatedAt: "14:35",
    category: "역사·산책",
    description: "넓은 광장과 궁궐 산책로가 이어지는 서울 중심의 대표 나들이 장소예요.",
    position: { top: 35, left: 49 },
    forecast: [
      { time: "15시", level: "약간 붐빔", value: 73 },
      { time: "17시", level: "보통", value: 60 },
      { time: "19시", level: "보통", value: 54 },
      { time: "21시", level: "여유", value: 35 },
      { time: "23시", level: "여유", value: 28 },
    ],
    scores: { "아이와 나들이": 91, 데이트: 76, "지금 핫플": 68 },
    tags: ["유모차 이동 편함", "무료 전시", "지하철 5분"],
  },
  {
    id: "seongsu",
    name: "성수 카페거리",
    district: "성동구",
    level: "보통",
    population: [5400, 6500],
    updatedAt: "14:32",
    category: "카페·쇼핑",
    description: "작은 전시와 카페, 팝업이 밀집한 골목형 산책 코스예요.",
    position: { top: 42, left: 73 },
    forecast: [
      { time: "15시", level: "보통", value: 55 },
      { time: "17시", level: "약간 붐빔", value: 78 },
      { time: "19시", level: "약간 붐빔", value: 82 },
      { time: "21시", level: "보통", value: 59 },
      { time: "23시", level: "여유", value: 32 },
    ],
    scores: { "아이와 나들이": 69, 데이트: 94, "지금 핫플": 96 },
    tags: ["실내 코스 많음", "팝업 진행 중", "주차 혼잡"],
  },
  {
    id: "yeouido",
    name: "한강공원 여의도",
    district: "영등포구",
    level: "여유",
    population: [3100, 4200],
    updatedAt: "14:31",
    category: "공원·야외",
    description: "강바람을 맞으며 쉬기 좋은 넓은 잔디와 자전거길이 있어요.",
    position: { top: 69, left: 34 },
    forecast: [
      { time: "15시", level: "여유", value: 31 },
      { time: "17시", level: "보통", value: 49 },
      { time: "19시", level: "보통", value: 52 },
      { time: "21시", level: "여유", value: 37 },
      { time: "23시", level: "여유", value: 21 },
    ],
    scores: { "아이와 나들이": 96, 데이트: 82, "지금 핫플": 61 },
    tags: ["잔디·놀이터", "따릉이 44대", "편의점 가까움"],
  },
  {
    id: "seoul-forest",
    name: "서울숲",
    district: "성동구",
    level: "여유",
    population: [2700, 3900],
    updatedAt: "14:28",
    category: "공원·산책",
    description: "아이와 함께 천천히 걷고 쉬기 좋은 숲길과 놀이터가 있어요.",
    position: { top: 52, left: 77 },
    forecast: [
      { time: "15시", level: "여유", value: 27 },
      { time: "17시", level: "여유", value: 34 },
      { time: "19시", level: "여유", value: 29 },
      { time: "21시", level: "여유", value: 18 },
      { time: "23시", level: "여유", value: 12 },
    ],
    scores: { "아이와 나들이": 98, 데이트: 88, "지금 핫플": 53 },
    tags: ["놀이터", "동물원", "산책로"],
  },
  {
    id: "bukchon",
    name: "북촌한옥마을",
    district: "종로구",
    level: "보통",
    population: [4800, 5600],
    updatedAt: "14:33",
    category: "역사·골목",
    description: "한옥 골목과 작은 공방을 둘러보는 조용한 산책 코스예요.",
    position: { top: 23, left: 51 },
    forecast: [
      { time: "15시", level: "보통", value: 56 },
      { time: "17시", level: "보통", value: 47 },
      { time: "19시", level: "여유", value: 32 },
      { time: "21시", level: "여유", value: 22 },
      { time: "23시", level: "여유", value: 14 },
    ],
    scores: { "아이와 나들이": 76, 데이트: 90, "지금 핫플": 74 },
    tags: ["경사 있음", "공방 체험", "주거지 예절"],
  },
  {
    id: "jamsil",
    name: "잠실 관광특구",
    district: "송파구",
    level: "약간 붐빔",
    population: [9100, 10800],
    updatedAt: "14:30",
    category: "쇼핑·문화",
    description: "실내 쇼핑과 공연을 한 번에 즐길 수 있는 가족형 복합 공간이에요.",
    position: { top: 55, left: 88 },
    forecast: [
      { time: "15시", level: "약간 붐빔", value: 76 },
      { time: "17시", level: "붐빔", value: 91 },
      { time: "19시", level: "약간 붐빔", value: 80 },
      { time: "21시", level: "보통", value: 59 },
      { time: "23시", level: "여유", value: 26 },
    ],
    scores: { "아이와 나들이": 88, 데이트: 83, "지금 핫플": 92 },
    tags: ["실내", "유료 전시", "주말 혼잡"],
  },
  {
    id: "hongdae",
    name: "홍대입구역",
    district: "마포구",
    level: "붐빔",
    population: [11200, 12800],
    updatedAt: "14:34",
    category: "문화·거리",
    description: "공연과 맛집, 쇼핑이 모여 있어 저녁 약속에 인기 있는 거리예요.",
    position: { top: 46, left: 23 },
    forecast: [
      { time: "15시", level: "붐빔", value: 94 },
      { time: "17시", level: "붐빔", value: 98 },
      { time: "19시", level: "붐빔", value: 96 },
      { time: "21시", level: "약간 붐빔", value: 82 },
      { time: "23시", level: "보통", value: 63 },
    ],
    scores: { "아이와 나들이": 45, 데이트: 79, "지금 핫플": 99 },
    tags: ["공연", "맛집", "현재 혼잡"],
  },
];

const levelClass: Record<Level, string> = {
  여유: "level-calm",
  보통: "level-steady",
  "약간 붐빔": "level-busy",
  붐빔: "level-crowded",
};

const levelOrder: Level[] = ["여유", "보통", "약간 붐빔", "붐빔"];
const presets: Preset[] = ["아이와 나들이", "데이트", "지금 핫플"];

function populationText(place: Place) {
  return `${place.population[0].toLocaleString("ko-KR")}–${place.population[1].toLocaleString("ko-KR")}`;
}

export default function Home() {
  const [selectedId, setSelectedId] = useState("gwanghwamun");
  const [search, setSearch] = useState("");
  const [activeLevel, setActiveLevel] = useState<Level | "전체">("전체");
  const [preset, setPreset] = useState<Preset>("아이와 나들이");
  const [sortMode, setSortMode] = useState<SortMode>("추천순");
  const [nearby, setNearby] = useState(false);
  const [copied, setCopied] = useState(false);

  const selected = places.find((place) => place.id === selectedId) ?? places[0];

  const filteredPlaces = useMemo(() => {
    const query = search.trim().toLowerCase();
    const result = places.filter((place) => {
      const matchesSearch =
        !query || `${place.name} ${place.district} ${place.category}`.toLowerCase().includes(query);
      const matchesLevel = activeLevel === "전체" || place.level === activeLevel;
      return matchesSearch && matchesLevel;
    });

    return [...result].sort((a, b) => {
      if (sortMode === "추천순") return b.scores[preset] - a.scores[preset];
      if (sortMode === "여유순") return levelOrder.indexOf(a.level) - levelOrder.indexOf(b.level);
      return levelOrder.indexOf(b.level) - levelOrder.indexOf(a.level);
    });
  }, [activeLevel, preset, search, sortMode]);

  async function sharePlace() {
    try {
      await navigator.clipboard?.writeText(window.location.href);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  }

  return (
    <main className="app-shell">
      <section className="hero-panel">
        <div className="hero-copy">
          <div className="eyebrow"><span className="signal-dot" /> SEOUL / LIVE CITY PULSE</div>
          <h1>오늘, 어디가<br /><em>편안할까요?</em></h1>
          <p>서울 곳곳의 혼잡도와 공식 예측을 한눈에 보고<br className="desktop-only" /> 가족의 다음 시간을 천천히 고르세요.</p>
        </div>
        <div className="hero-status glass-card">
          <span className="status-kicker">서울 전체 분위기</span>
          <strong>보통</strong>
          <span>121곳 중 83곳 확인</span>
          <div className="status-track"><i style={{ width: "68%" }} /></div>
          <small>14:35 기준 · 15분마다 새로워져요</small>
        </div>
      </section>

      <section className="control-row" aria-label="장소 검색과 목적 선택">
        <label className="search-box glass-card">
          <span aria-hidden="true">⌕</span>
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="명소나 동네를 찾아보세요" aria-label="명소나 동네 검색" />
          {search && <button type="button" onClick={() => setSearch("")} aria-label="검색어 지우기">×</button>}
        </label>
        <button type="button" className={`location-button glass-card ${nearby ? "is-active" : ""}`} onClick={() => setNearby((value) => !value)}>
          <span aria-hidden="true">◎</span> {nearby ? "내 주변 켜짐" : "내 주변"}
        </button>
      </section>

      <section className="preset-section">
        <div className="section-heading">
          <div><span className="section-label">CHOOSE A MOOD</span><h2>오늘의 목적</h2></div>
          <span className="muted-copy">추천 순서는 혼잡도·공간 성격을 함께 봐요</span>
        </div>
        <div className="preset-list">
          {presets.map((item) => (
            <button key={item} type="button" className={`preset-card glass-card ${preset === item ? "is-selected" : ""}`} onClick={() => setPreset(item)} aria-pressed={preset === item}>
              <span className="preset-icon" aria-hidden="true">{item === "아이와 나들이" ? "✦" : item === "데이트" ? "◌" : "↗"}</span>
              <span><strong>{item}</strong><small>{item === "아이와 나들이" ? "걷기 편하고 여유로운 곳" : item === "데이트" ? "분위기와 발견이 있는 곳" : "지금 가장 생생한 거리"}</small></span>
              <span className="chevron" aria-hidden="true">›</span>
            </button>
          ))}
        </div>
      </section>

      <section className="explore-layout">
        <div className="map-column">
          <div className="section-heading map-heading"><div><span className="section-label">LIVE MAP</span><h2>서울 한눈에 보기</h2></div><span className="map-note"><span className="map-note-dot" /> 실제 데이터 연결 전 미리보기</span></div>
          <div className="map-card glass-card">
            <div className="map-water water-one" /><div className="map-water water-two" />
            <div className="map-road road-one" /><div className="map-road road-two" /><div className="map-road road-three" /><div className="map-road road-four" />
            <div className="map-label label-top">북한산</div><div className="map-label label-center">한강</div><div className="map-label label-east">잠실</div>
            {places.map((place) => (
              <button key={place.id} type="button" className={`map-marker ${levelClass[place.level]} ${selected.id === place.id ? "is-selected" : ""}`} style={{ top: `${place.position.top}%`, left: `${place.position.left}%` }} onClick={() => setSelectedId(place.id)} aria-label={`${place.name}, ${place.level}`}>
                <span />
              </button>
            ))}
            {nearby && <div className="user-location" aria-label="내 주변 위치"><span /></div>}
            <div className="map-legend glass-card"><span><i className="legend-dot level-calm" />여유</span><span><i className="legend-dot level-steady" />보통</span><span><i className="legend-dot level-busy" />약간 붐빔</span><span><i className="legend-dot level-crowded" />붐빔</span></div>
          </div>
          <div className="map-attribution">지도는 위치 관계를 이해하기 위한 추상화된 미리보기입니다 · 혼잡도 출처: 서울특별시 서울 열린데이터광장</div>
        </div>

        <aside className="list-column" aria-label="추천 장소 목록">
          <div className="section-heading list-heading"><div><span className="section-label">FOR YOU</span><h2>{preset}</h2></div><select value={sortMode} onChange={(event) => setSortMode(event.target.value as SortMode)} aria-label="장소 정렬"><option>추천순</option><option>여유순</option><option>붐빔순</option></select></div>
          <div className="filter-row" role="group" aria-label="혼잡도 필터">
            {["전체", ...levelOrder].map((level) => <button key={level} type="button" className={activeLevel === level ? "is-active" : ""} onClick={() => setActiveLevel(level as Level | "전체")} aria-pressed={activeLevel === level}>{level}</button>)}
          </div>
          <div className="place-list">
            {filteredPlaces.map((place) => (
              <button type="button" key={place.id} className={`place-card glass-card ${selected.id === place.id ? "is-selected" : ""}`} onClick={() => setSelectedId(place.id)}>
                <span className={`place-status ${levelClass[place.level]}`}><i />{place.level}</span>
                <span className="place-main"><strong>{place.name}</strong><small>{place.district} · {place.category}</small></span>
                <span className="place-meta"><b>{populationText(place)}</b><small>명 추정</small></span>
                <span className="place-score">{place.scores[preset]}<small>추천</small></span>
              </button>
            ))}
            {filteredPlaces.length === 0 && <div className="empty-state glass-card">조건에 맞는 장소가 없어요.<br />검색어나 필터를 조금 바꿔보세요.</div>}
          </div>
        </aside>
      </section>

      <section className="detail-section glass-card">
        <div className="detail-topline"><span className={`detail-status ${levelClass[selected.level]}`}><i />{selected.level}</span><span>{selected.updatedAt} 업데이트</span></div>
        <div className="detail-grid">
          <div className="detail-copy"><span className="section-label">SELECTED PLACE</span><h2>{selected.name}</h2><p>{selected.description}</p><div className="detail-tags">{selected.tags.map((tag) => <span key={tag}>{tag}</span>)}</div><div className="detail-actions"><a href={`https://map.kakao.com/?q=${encodeURIComponent(selected.name)}`} target="_blank" rel="noreferrer" className="primary-action">길찾기 <span aria-hidden="true">↗</span></a><button type="button" className="secondary-action" onClick={sharePlace}>{copied ? "링크가 복사됐어요" : "가족에게 공유"}</button></div></div>
          <div className="forecast-panel"><div className="forecast-title"><span>앞으로 8시간</span><b>공식 예측</b></div><div className="forecast-chart">{selected.forecast.map((item) => <div className="forecast-bar" key={item.time}><span className="bar-value" style={{ height: `${Math.max(item.value, 12)}%` }}><i className={levelClass[item.level]} /></span><small>{item.time}</small></div>)}</div><p className="forecast-note">{selected.forecast[0].level !== selected.forecast[3].level ? `${selected.forecast[3].time}부터 ${selected.forecast[3].level} 단계로 낮아질 것으로 보여요.` : "앞으로도 지금과 비슷한 흐름이 이어질 것으로 보여요."}</p></div>
        </div>
      </section>

      <footer className="app-footer"><span>Seoul Crowd Radar · Calm Glass</span><span>수치는 UI 확인용 예시 데이터이며 실제 현장과 다를 수 있어요.</span></footer>
    </main>
  );
}
