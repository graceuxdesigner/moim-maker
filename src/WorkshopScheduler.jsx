import { useState, useEffect, useCallback, useMemo } from "react";

const MONTH_NAMES_KR = ["1월","2월","3월","4월","5월","6월","7월","8월","9월","10월","11월","12월"];
const DAY_NAMES_KR = ["일","월","화","수","목","금","토"];

function getMonthDays(year, month) {
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const days = [];
  for (let i = 0; i < firstDay; i++) days.push(null);
  for (let d = 1; d <= daysInMonth; d++) days.push(d);
  return days;
}

function dateKey(year, month, day) {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function getWedThuFri(year, month, day) {
  const date = new Date(year, month, day);
  const dow = date.getDay();
  const keys = [];
  for (const target of [3, 4, 5]) {
    const diff = target - dow;
    const d = new Date(year, month, day + diff);
    keys.push(dateKey(d.getFullYear(), d.getMonth(), d.getDate()));
  }
  return keys;
}

function parseKey(key) {
  const [y, m, d] = key.split("-").map(Number);
  return { year: y, month: m - 1, day: d };
}

const STORAGE_KEY = "workshop-scheduler-v2";

const BLOCKED_DATES = new Set([
  "2026-07-15", "2026-07-16", "2026-07-17",
  "2026-09-23", "2026-09-24", "2026-09-25",
]);

function generateMonths() {
  return [
    { year: 2026, month: 6 },  // 7월
    { year: 2026, month: 7 },  // 8월
    { year: 2026, month: 8 },  // 9월
  ];
}

const MEDAL = ["🥇", "🥈", "🥉"];
const MEDAL_COLORS = ["#FFD700", "#C0C0C0", "#CD7F32"];

export default function WorkshopScheduler() {
  const [allUsers, setAllUsers] = useState({});
  const [currentUser, setCurrentUser] = useState("");
  const [nameInput, setNameInput] = useState("");
  const [loggedIn, setLoggedIn] = useState(false);
  const [hoveredGroup, setHoveredGroup] = useState(null);
  const [hoveredInfo, setHoveredInfo] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [highlightedRank, setHighlightedRank] = useState(null);

  const months = generateMonths();

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) setAllUsers(JSON.parse(saved));
    } catch (e) {}
    setIsLoading(false);
  }, []);

  const saveData = useCallback((data) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (e) {
      console.error("Save failed:", e);
    }
  }, []);

  const handleLogin = () => {
    const name = nameInput.trim();
    if (!name) return;
    setCurrentUser(name);
    setLoggedIn(true);
    if (!allUsers[name]) {
      const updated = { ...allUsers, [name]: [] };
      setAllUsers(updated);
      saveData(updated);
    }
  };

  const handleLogout = () => {
    setLoggedIn(false);
    setCurrentUser("");
    setNameInput("");
  };

  const toggleWTFGroup = (year, month, day) => {
    if (!loggedIn) return;
    const group = getWedThuFri(year, month, day);
    const userDates = allUsers[currentUser] || [];
    const allSelected = group.every(k => userDates.includes(k));
    let newDates;
    if (allSelected) {
      newDates = userDates.filter(d => !group.includes(d));
    } else {
      newDates = [...new Set([...userDates, ...group])];
    }
    const updated = { ...allUsers, [currentUser]: newDates };
    setAllUsers(updated);
    saveData(updated);
  };

  const userNames = Object.keys(allUsers);
  const totalUsers = userNames.length;

  const isUnavailable = (key) => {
    if (!currentUser) return false;
    return (allUsers[currentUser] || []).includes(key);
  };

  const getDateInfo = (key) => {
    const unavailable = userNames.filter(u => (allUsers[u] || []).includes(key));
    const available = userNames.filter(u => !(allUsers[u] || []).includes(key));
    return { available, unavailable, allAvailable: totalUsers > 0 && unavailable.length === 0 };
  };

  const isPast = (year, month, day) => {
    const d = new Date(year, month, day);
    const t = new Date(); t.setHours(0, 0, 0, 0);
    return d < t;
  };

  const deleteUser = (name) => {
    const updated = { ...allUsers };
    delete updated[name];
    setAllUsers(updated);
    saveData(updated);
    if (name === currentUser) handleLogout();
  };

  const rankedWeeks = useMemo(() => {
    if (totalUsers === 0) return [];
    const seen = new Set();
    const weeks = [];
    const today = new Date(); today.setHours(0,0,0,0);

    for (const { year, month } of months) {
      const daysInMonth = new Date(year, month + 1, 0).getDate();
      for (let d = 1; d <= daysInMonth; d++) {
        const dow = new Date(year, month, d).getDay();
        if (dow !== 3) continue;
        if (new Date(year, month, d) < today) continue;
        const group = getWedThuFri(year, month, d);
        if (group.some(k => BLOCKED_DATES.has(k))) continue;
        const groupKey = group.join("|");
        if (seen.has(groupKey)) continue;
        seen.add(groupKey);

        const unavailSet = new Set();
        group.forEach(k => {
          userNames.forEach(u => {
            if ((allUsers[u] || []).includes(k)) unavailSet.add(u);
          });
        });

        weeks.push({
          group,
          groupKey,
          unavailCount: unavailSet.size,
          unavailNames: [...unavailSet],
          availCount: totalUsers - unavailSet.size,
          availNames: userNames.filter(u => !unavailSet.has(u)),
        });
      }
    }

    weeks.sort((a, b) => a.unavailCount - b.unavailCount);
    return weeks;
  }, [allUsers, userNames, totalUsers, months]);

  if (isLoading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100vh", background: "#08080d", color: "#aaa", fontFamily: "'Pretendard', sans-serif" }}>
        불러오는 중...
      </div>
    );
  }

  const formatGroupLabel = (group) => {
    const parsed = group.map(k => parseKey(k));
    const p = parsed[0];
    return `${p.month + 1}/${p.day}–${parsed[2].day}`;
  };

  const formatGroupFull = (group) => {
    const parsed = group.map(k => parseKey(k));
    return parsed.map(p => `${p.month + 1}/${p.day}(${DAY_NAMES_KR[new Date(p.year, p.month, p.day).getDay()]})`).join(", ");
  };

  return (
    <div style={{
      minHeight: "100vh",
      background: "#08080d",
      color: "#e0e0e0",
      fontFamily: "'Pretendard', -apple-system, BlinkMacSystemFont, sans-serif",
    }}>
      <style>{`
        @import url('https://cdn.jsdelivr.net/gh/orioncactus/pretendard/dist/web/static/pretendard.css');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes glowGold { 0%,100% { box-shadow: 0 0 0 0 rgba(255,215,0,0.15); } 50% { box-shadow: 0 0 12px 2px rgba(255,215,0,0.08); } }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.08); border-radius: 4px; }
      `}</style>

      {/* Header */}
      <div style={{ textAlign: "center", padding: "24px 16px 12px", animation: "fadeIn 0.4s ease" }}>
        <div style={{ fontSize: 11, letterSpacing: 5, color: "#63d297", textTransform: "uppercase", marginBottom: 6, fontWeight: 600 }}>
          세일즈플러스 양양
        </div>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: "#fff", letterSpacing: -0.5 }}>일정 조율</h1>
      </div>

      {/* Login Area */}
      <div style={{ maxWidth: 900, margin: "0 auto", padding: "0 16px" }}>
        {!loggedIn ? (
          <div style={{
            background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)",
            borderRadius: 12, padding: 24, marginBottom: 16, animation: "fadeIn 0.4s ease",
            maxWidth: 400, margin: "0 auto 16px",
          }}>
            <label style={{ fontSize: 12, color: "#666", display: "block", marginBottom: 8 }}>이름</label>
            <div style={{ display: "flex", gap: 8 }}>
              <input
                value={nameInput}
                onChange={e => setNameInput(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleLogin()}
                placeholder="이름 입력"
                style={{
                  flex: 1, padding: "11px 14px",
                  background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
                  borderRadius: 8, color: "#fff", fontSize: 14, outline: "none",
                }}
                onFocus={e => e.target.style.borderColor = "rgba(99,210,151,0.4)"}
                onBlur={e => e.target.style.borderColor = "rgba(255,255,255,0.08)"}
              />
              <button onClick={handleLogin} style={{
                padding: "11px 20px", background: "#63d297", border: "none", borderRadius: 8,
                color: "#000", fontSize: 13, fontWeight: 700, cursor: "pointer",
              }}>선택 시작</button>
            </div>
            {userNames.length > 0 && (
              <div style={{ marginTop: 14 }}>
                <div style={{ fontSize: 11, color: "#555", marginBottom: 6 }}>기존 참가자</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                  {userNames.map(name => (
                    <div key={name} style={{
                      display: "flex", alignItems: "center", gap: 2,
                      padding: "5px 6px 5px 11px", background: "rgba(99,210,151,0.06)",
                      border: "1px solid rgba(99,210,151,0.15)", borderRadius: 14,
                    }}>
                      <span onClick={() => { setCurrentUser(name); setLoggedIn(true); }}
                        style={{ color: "#63d297", fontSize: 12, cursor: "pointer" }}>{name}</span>
                      <button onClick={(e) => { e.stopPropagation(); if(window.confirm(`${name}의 데이터를 삭제할까요?`)) deleteUser(name); }}
                        style={{
                          background: "none", border: "none", color: "#ff6b6b",
                          fontSize: 13, cursor: "pointer", padding: "0 4px", lineHeight: 1,
                          opacity: 0.5, transition: "opacity 0.15s",
                        }}
                        onMouseEnter={e => e.target.style.opacity = 1}
                        onMouseLeave={e => e.target.style.opacity = 0.5}
                      >×</button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div style={{
            display: "flex", justifyContent: "space-between", alignItems: "center",
            background: "rgba(99,210,151,0.04)", border: "1px solid rgba(99,210,151,0.1)",
            borderRadius: 10, padding: "9px 14px", marginBottom: 14,
            maxWidth: 900, margin: "0 auto 14px",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{
                width: 26, height: 26, borderRadius: "50%", background: "#63d297",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 11, fontWeight: 800, color: "#000",
              }}>{currentUser[0]}</div>
              <span style={{ fontSize: 14, fontWeight: 600, color: "#fff" }}>{currentUser}</span>
              <span style={{ fontSize: 11, color: "#555" }}>— 불가능한 수·목·금을 선택하세요</span>
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              <button onClick={() => {
                if(window.confirm(`${currentUser}의 선택을 모두 초기화할까요?`)) {
                  const updated = { ...allUsers, [currentUser]: [] };
                  setAllUsers(updated);
                  saveData(updated);
                }
              }} style={{
                padding: "5px 14px", background: "rgba(255,85,85,0.08)",
                border: "1px solid rgba(255,85,85,0.2)", borderRadius: 6,
                color: "#ff6b6b", fontSize: 12, fontWeight: 600, cursor: "pointer",
              }}>전체 재선택</button>
              <button onClick={handleLogout} style={{
                padding: "5px 14px", background: "rgba(99,210,151,0.1)",
                border: "1px solid rgba(99,210,151,0.2)", borderRadius: 6,
                color: "#63d297", fontSize: 12, fontWeight: 600, cursor: "pointer",
              }}>선택완료</button>
            </div>
          </div>
        )}
      </div>

      {/* Two-column layout */}
      <div style={{
        display: "flex", gap: 16, maxWidth: 900, margin: "0 auto", padding: "0 16px 32px",
        alignItems: "flex-start",
      }}>
        {/* LEFT: Calendar */}
        <div style={{
          flex: "1 1 55%", minWidth: 0,
          maxHeight: "70vh", overflowY: "auto",
          borderRadius: 14, border: "1px solid rgba(255,255,255,0.05)",
          background: "rgba(255,255,255,0.01)",
        }}>
          {months.map(({ year, month }, mIdx) => {
            const days = getMonthDays(year, month);
            return (
              <div key={`${year}-${month}`} style={{
                padding: "18px 16px",
                borderBottom: mIdx < months.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none",
              }}>
                <div style={{ marginBottom: 12 }}>
                  <span style={{ fontSize: 17, fontWeight: 700, color: "#fff" }}>{MONTH_NAMES_KR[month]}</span>
                  <span style={{ fontSize: 11, color: "#444", marginLeft: 6 }}>{year}</span>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 3, marginBottom: 5 }}>
                  {DAY_NAMES_KR.map((d, i) => (
                    <div key={d} style={{
                      textAlign: "center", fontSize: 10, fontWeight: 500, padding: "2px 0",
                      color: i === 0 ? "rgba(255,100,100,0.5)" : i === 6 ? "rgba(74,158,255,0.5)" : "#444",
                    }}>{d}</div>
                  ))}
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 3 }}>
                  {days.map((day, idx) => {
                    if (!day) return <div key={`e-${idx}`} />;

                    const key = dateKey(year, month, day);
                    const dow = new Date(year, month, day).getDay();
                    const isWTF = dow >= 3 && dow <= 5;
                    const past = isPast(year, month, day);
                    const blocked = BLOCKED_DATES.has(key);
                    const unavail = isUnavailable(key);
                    const info = getDateInfo(key);
                    const wtfGroup = isWTF ? getWedThuFri(year, month, day) : [];
                    const isInHoveredGroup = hoveredGroup && hoveredGroup.includes(key);
                    const isInHighlight = highlightedRank && highlightedRank.includes(key);

                    let bg = "transparent";
                    let border = "1px solid transparent";
                    let textColor = (past || blocked) ? "#2a2a2a" : isWTF ? "#bbb" : "#383838";
                    let cursor = "default";
                    let borderRadius = "7px";

                    if (isWTF) {
                      if (dow === 3) borderRadius = "7px 2px 2px 7px";
                      else if (dow === 4) borderRadius = "2px";
                      else if (dow === 5) borderRadius = "2px 7px 7px 2px";
                    }

                    if (isWTF && !past && !blocked && loggedIn) {
                      cursor = "pointer";
                      if (unavail) {
                        bg = "rgba(255,85,85,0.14)";
                        border = "1px solid rgba(255,85,85,0.25)";
                        textColor = "#ff6b6b";
                      }
                      if (isInHoveredGroup) {
                        bg = unavail ? "rgba(255,85,85,0.22)" : "rgba(99,210,151,0.1)";
                        border = unavail ? "1px solid rgba(255,85,85,0.35)" : "1px solid rgba(99,210,151,0.25)";
                      }
                    } else if (isWTF && !past && !blocked && !loggedIn && totalUsers > 0) {
                      const ratio = info.unavailable.length / totalUsers;
                      if (ratio > 0) {
                        bg = `rgba(255,85,85,${0.03 + ratio * 0.15})`;
                        border = `1px solid rgba(255,85,85,${0.06 + ratio * 0.2})`;
                      } else {
                        bg = "rgba(99,210,151,0.06)";
                        border = "1px solid rgba(99,210,151,0.12)";
                        textColor = "#63d297";
                      }
                    }

                    if (isInHighlight && isWTF) {
                      bg = "rgba(255,215,0,0.12)";
                      border = "1px solid rgba(255,215,0,0.3)";
                      textColor = "#FFD700";
                    }

                    if (!isWTF) {
                      bg = "transparent";
                      border = "1px solid transparent";
                      textColor = past ? "#1a1a1a" : "#2a2a2a";
                    }

                    return (
                      <div
                        key={day}
                        onClick={() => {
                          if (isWTF && !past && !blocked && loggedIn) toggleWTFGroup(year, month, day);
                        }}
                        onMouseEnter={() => {
                          if (isWTF && !past && !blocked) {
                            setHoveredGroup(wtfGroup);
                            setHoveredInfo({ key, year, month, day });
                          }
                        }}
                        onMouseLeave={() => { setHoveredGroup(null); setHoveredInfo(null); }}
                        style={{
                          aspectRatio: "1",
                          display: "flex", flexDirection: "column",
                          alignItems: "center", justifyContent: "center",
                          borderRadius, background: bg, border, color: textColor,
                          fontSize: 12, fontWeight: isWTF ? (unavail ? 700 : 500) : 400,
                          cursor, transition: "all 0.12s ease",
                        }}
                      >
                        <span>{day}</span>
                        {isWTF && totalUsers > 0 && info.unavailable.length > 0 && !loggedIn && (
                          <span style={{ fontSize: 8, color: "rgba(255,120,120,0.6)", marginTop: 0, fontWeight: 600 }}>
                            {info.unavailable.length}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {/* RIGHT: Ranking Panel */}
        <div style={{
          flex: "1 1 45%", minWidth: 0,
          position: "sticky", top: 16,
          display: "flex", flexDirection: "column", gap: 12,
        }}>
          <div style={{
            background: "rgba(255,255,255,0.02)",
            border: "1px solid rgba(255,255,255,0.06)",
            borderRadius: 14, padding: 20,
          }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#fff", marginBottom: 4 }}>
              추천 일정
            </div>
            <div style={{ fontSize: 11, color: "#555", marginBottom: 16 }}>
              불가 인원이 적은 순
            </div>

            {totalUsers === 0 ? (
              <div style={{ fontSize: 12, color: "#444", textAlign: "center", padding: "20px 0" }}>
                참가자가 등록되면 순위가 표시됩니다
              </div>
            ) : rankedWeeks.length === 0 ? (
              <div style={{ fontSize: 12, color: "#444", textAlign: "center", padding: "20px 0" }}>
                선택 가능한 주가 없습니다
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {rankedWeeks.slice(0, 3).map((week, i) => (
                  <div
                    key={week.groupKey}
                    onMouseEnter={() => setHighlightedRank(week.group)}
                    onMouseLeave={() => setHighlightedRank(null)}
                    style={{
                      background: i === 0 ? "rgba(255,215,0,0.04)" : i === 1 ? "rgba(192,192,192,0.03)" : "rgba(205,127,50,0.03)",
                      border: `1px solid ${i === 0 ? "rgba(255,215,0,0.15)" : i === 1 ? "rgba(192,192,192,0.12)" : "rgba(205,127,50,0.1)"}`,
                      borderRadius: 10, padding: 14, cursor: "pointer",
                      transition: "all 0.15s ease",
                      animation: i === 0 ? "glowGold 3s infinite" : "none",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                      <span style={{ fontSize: 20 }}>{MEDAL[i]}</span>
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 700, color: MEDAL_COLORS[i] }}>
                          {formatGroupLabel(week.group)}
                        </div>
                        <div style={{ fontSize: 10, color: "#666", marginTop: 1 }}>
                          {formatGroupFull(week.group)}
                        </div>
                      </div>
                    </div>

                    <div style={{ display: "flex", gap: 12, marginTop: 4 }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 10, color: "#63d297", fontWeight: 600, marginBottom: 4 }}>
                          가능 {week.availCount}/{totalUsers}
                        </div>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 3 }}>
                          {week.availNames.map(n => (
                            <span key={n} style={{
                              padding: "2px 7px", background: "rgba(99,210,151,0.08)",
                              borderRadius: 10, fontSize: 10, color: "#63d297",
                            }}>{n}</span>
                          ))}
                        </div>
                      </div>
                      {week.unavailCount > 0 && (
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 10, color: "#ff6b6b", fontWeight: 600, marginBottom: 4 }}>
                            불가 {week.unavailCount}
                          </div>
                          <div style={{ display: "flex", flexWrap: "wrap", gap: 3 }}>
                            {week.unavailNames.map(n => (
                              <span key={n} style={{
                                padding: "2px 7px", background: "rgba(255,85,85,0.08)",
                                borderRadius: 10, fontSize: 10, color: "#ff6b6b",
                              }}>{n}</span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    <div style={{
                      marginTop: 10, height: 3, borderRadius: 2,
                      background: "rgba(255,255,255,0.04)", overflow: "hidden",
                    }}>
                      <div style={{
                        height: "100%", borderRadius: 2,
                        width: `${(week.availCount / totalUsers) * 100}%`,
                        background: i === 0
                          ? "linear-gradient(90deg, #FFD700, #63d297)"
                          : i === 1
                            ? "linear-gradient(90deg, #C0C0C0, #63d297)"
                            : "linear-gradient(90deg, #CD7F32, #63d297)",
                        transition: "width 0.3s ease",
                      }} />
                    </div>
                  </div>
                ))}

                {rankedWeeks.length > 3 && (
                  <div style={{ marginTop: 4 }}>
                    <div style={{ fontSize: 10, color: "#444", marginBottom: 6 }}>그 외</div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                      {rankedWeeks.slice(3, 8).map((week) => (
                        <div
                          key={week.groupKey}
                          onMouseEnter={() => setHighlightedRank(week.group)}
                          onMouseLeave={() => setHighlightedRank(null)}
                          style={{
                            display: "flex", justifyContent: "space-between", alignItems: "center",
                            padding: "6px 10px",
                            background: "rgba(255,255,255,0.015)",
                            border: "1px solid rgba(255,255,255,0.03)",
                            borderRadius: 6, cursor: "pointer",
                            transition: "all 0.12s ease",
                          }}
                        >
                          <span style={{ fontSize: 11, color: "#777" }}>{formatGroupLabel(week.group)}</span>
                          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <span style={{ fontSize: 10, color: "#63d297" }}>가능 {week.availCount}</span>
                            {week.unavailCount > 0 && (
                              <span style={{ fontSize: 10, color: "#ff6b6b" }}>불가 {week.unavailCount}</span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {hoveredInfo && totalUsers > 0 && (
            <div style={{
              padding: 14,
              background: "rgba(18,18,28,0.95)", border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: 10, animation: "fadeIn 0.15s ease",
            }}>
              {(() => {
                const group = getWedThuFri(hoveredInfo.year, hoveredInfo.month, hoveredInfo.day);
                const groupInfos = group.map(k => ({ key: k, ...getDateInfo(k) }));
                const allUnavail = [...new Set(groupInfos.flatMap(g => g.unavailable))];
                const allAvail = userNames.filter(u => !allUnavail.includes(u));
                return (
                  <>
                    <div style={{ fontSize: 12, fontWeight: 600, color: "#fff", marginBottom: 8 }}>
                      {formatGroupFull(group)}
                    </div>
                    <div style={{ display: "flex", gap: 14 }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 10, color: "#63d297", marginBottom: 4, fontWeight: 600 }}>가능 ({allAvail.length})</div>
                        {allAvail.length === 0
                          ? <div style={{ fontSize: 11, color: "#444" }}>—</div>
                          : allAvail.map(n => <div key={n} style={{ fontSize: 11, color: "#999", padding: "1px 0" }}>{n}</div>)
                        }
                      </div>
                      <div style={{ width: 1, background: "rgba(255,255,255,0.06)" }} />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 10, color: "#ff6b6b", marginBottom: 4, fontWeight: 600 }}>불가 ({allUnavail.length})</div>
                        {allUnavail.length === 0
                          ? <div style={{ fontSize: 11, color: "#444" }}>—</div>
                          : allUnavail.map(n => (
                            <div key={n} style={{ fontSize: 11, color: "#cc8888", padding: "1px 0" }}>{n}</div>
                          ))
                        }
                      </div>
                    </div>
                  </>
                );
              })()}
            </div>
          )}

          {userNames.length > 0 && (
            <div style={{
              padding: 14, background: "rgba(255,255,255,0.02)",
              border: "1px solid rgba(255,255,255,0.05)", borderRadius: 10,
            }}>
              <div style={{ fontSize: 11, color: "#555", marginBottom: 8, fontWeight: 600 }}>참가자 ({totalUsers})</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                {userNames.map(name => {
                  const count = (allUsers[name] || []).length;
                  return (
                    <div key={name} style={{
                      display: "flex", alignItems: "center", gap: 5, padding: "5px 10px",
                      background: name === currentUser ? "rgba(99,210,151,0.06)" : "rgba(255,255,255,0.02)",
                      border: name === currentUser ? "1px solid rgba(99,210,151,0.15)" : "1px solid rgba(255,255,255,0.04)",
                      borderRadius: 7,
                    }}>
                      <div style={{
                        width: 18, height: 18, borderRadius: "50%",
                        background: name === currentUser ? "#63d297" : "rgba(255,255,255,0.06)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 9, fontWeight: 700, color: name === currentUser ? "#000" : "#555",
                      }}>{name[0]}</div>
                      <span style={{ fontSize: 11, color: name === currentUser ? "#63d297" : "#888" }}>{name}</span>
                      <span style={{ fontSize: 9, color: "#444" }}>{count}일</span>
                      {loggedIn && currentUser === name && (
                        <button onClick={() => deleteUser(name)} style={{
                          background: "none", border: "none", color: "#ff6b6b",
                          fontSize: 12, cursor: "pointer", padding: "0 2px", lineHeight: 1,
                        }}>×</button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
