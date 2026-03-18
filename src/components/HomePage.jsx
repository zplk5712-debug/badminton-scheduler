import React from "react";
import monkeyzLogo from "../assets/monkeyz-logo.jpg";

const MODE_META = {
  friendly: {
    key: "friendly",
    title: "친선전",
    icon: "교류",
    badge: "Flexible Match",
    description:
      "라운드마다 새 조를 만들고, 개인 목표 경기 수와 개인 승점 집계를 함께 관리하는 모드입니다.",
    highlights: ["개인 목표 경기", "개인 순위 집계", "수동 대진 추가"],
    buttonText: "친선전 시작",
    accent: "friendly",
  },
  tournament: {
    key: "tournament",
    title: "대회",
    icon: "토너먼트",
    badge: "Tournament",
    description:
      "조 단위 등록을 기준으로 예선 박스, 순위 산정, 본선 진출과 브래킷 운영까지 이어지는 대회형 모드입니다.",
    highlights: ["3조 우선 예선", "본선 자동 진출", "조 단위 등록"],
    buttonText: "대회 시작",
    accent: "tournament",
  },
  rivalry: {
    key: "rivalry",
    title: "대항전",
    icon: "팀전",
    badge: "Team Match",
    description:
      "A팀과 B팀 고정 파트너를 기준으로 경기 수를 배정하고, 팀 합산 승점으로 승패를 판단하는 모드입니다.",
    highlights: ["팀 자동 조 편성", "팀 승점판", "개인 목표 경기"],
    buttonText: "대항전 시작",
    accent: "rivalry",
  },
  league: {
    key: "league",
    title: "정기전",
    icon: "리그",
    badge: "League Board",
    description:
      "팀 편성, 팀 내 순위, 코트별 일정, 수동 조 유지와 재생성 분리를 함께 관리하는 리그형 모드입니다.",
    highlights: ["팀별 순위", "수동 조 유지", "생성/재생성 분리"],
    buttonText: "정기전 시작",
    accent: "league",
  },
};

const DEFAULT_MODE_ORDER = ["friendly", "tournament", "rivalry", "league"];

function resolveModes(modes) {
  const source = Array.isArray(modes) && modes.length > 0 ? modes : DEFAULT_MODE_ORDER.map((key) => ({ key }));
  const resolved = source
    .map((mode) => {
      const key = mode?.key || mode?.value;
      if (!key || !MODE_META[key]) return null;
      return {
        ...MODE_META[key],
        key,
      };
    })
    .filter(Boolean);

  return resolved.length > 0 ? resolved : DEFAULT_MODE_ORDER.map((key) => MODE_META[key]);
}

export default function HomePage({ onSelectMode, modes }) {
  const resolvedModes = resolveModes(modes);

  const handleSelect = (modeKey) => {
    if (typeof onSelectMode === "function") {
      onSelectMode(modeKey);
    }
  };

  return (
    <>
      <style>{`
        *{
          box-sizing:border-box;
        }

        .home-root{
          width:100%;
        }

        .home-shell{
          width:100%;
          max-width:1280px;
          margin:0 auto;
          display:flex;
          flex-direction:column;
          gap:28px;
        }

        .home-hero{
          position:relative;
          overflow:hidden;
          border-radius:34px;
          padding:34px 38px 36px;
          background:
            radial-gradient(circle at 16% 18%, rgba(59,130,246,0.24), transparent 24%),
            radial-gradient(circle at 82% 24%, rgba(251,146,60,0.16), transparent 16%),
            radial-gradient(circle at 74% 78%, rgba(125,211,252,0.18), transparent 22%),
            linear-gradient(135deg, #16213f 0%, #2140a4 42%, #3b82f6 74%, #7cb8ff 100%);
          color:#fff;
          box-shadow:0 24px 52px rgba(15,23,42,0.18);
        }

        .hero-inner{
          position:relative;
          z-index:2;
          display:grid;
          grid-template-columns:minmax(0, 1.1fr) minmax(320px, 380px);
          gap:28px;
          align-items:center;
        }

        .hero-copy{
          display:flex;
          flex-direction:column;
          align-items:flex-start;
          gap:12px;
        }

        .hero-badge{
          display:inline-flex;
          align-items:center;
          min-height:38px;
          padding:0 18px;
          border-radius:999px;
          background:rgba(255,255,255,0.12);
          border:1px solid rgba(255,255,255,0.22);
          font-size:12px;
          font-weight:900;
          letter-spacing:0.14em;
          text-transform:uppercase;
          backdrop-filter:blur(10px);
        }

        .hero-brand{
          margin:4px 0 0;
          font-size:82px;
          line-height:0.92;
          font-weight:900;
          letter-spacing:-0.05em;
        }

        .hero-title{
          margin:0;
          font-size:30px;
          line-height:1.18;
          font-weight:900;
          color:#f8fafc;
        }

        .hero-subtitle{
          margin-top:6px;
          font-size:18px;
          line-height:1.5;
          font-weight:900;
          color:#fde68a;
        }

        .hero-desc{
          max-width:640px;
          margin-top:6px;
          font-size:15px;
          line-height:1.78;
          color:rgba(255,255,255,0.9);
          font-weight:600;
        }

        .hero-visual{
          position:relative;
          min-height:300px;
          display:flex;
          align-items:center;
          justify-content:center;
        }

        .hero-orbit{
          position:absolute;
          inset:18px 30px;
          border-radius:44px;
          transform:rotate(-8deg);
          background:
            linear-gradient(135deg, rgba(255,255,255,0.18), rgba(255,255,255,0.04)),
            radial-gradient(circle at 50% 50%, rgba(255,255,255,0.12), transparent 68%);
          border:1px solid rgba(255,255,255,0.14);
        }

        .hero-orbit::before{
          content:"";
          position:absolute;
          inset:16px;
          border-radius:32px;
          border:1px dashed rgba(255,255,255,0.24);
        }

        .hero-logo-wrap{
          position:relative;
          z-index:2;
          width:236px;
          height:236px;
          display:flex;
          align-items:center;
          justify-content:center;
          border-radius:44px;
          background:linear-gradient(180deg, rgba(255,255,255,0.98), rgba(241,245,249,0.94));
          border:1px solid rgba(255,255,255,0.55);
          box-shadow:
            0 28px 48px rgba(15,23,42,0.24),
            inset 0 1px 0 rgba(255,255,255,0.72);
          transform:rotate(6deg);
        }

        .hero-logo{
          width:188px;
          height:auto;
          filter:drop-shadow(0 12px 18px rgba(15,23,42,0.16));
        }

        .hero-stamp{
          position:absolute;
          top:6px;
          right:18px;
          z-index:3;
          display:inline-flex;
          align-items:center;
          min-height:38px;
          padding:0 16px;
          border-radius:999px;
          background:rgba(15,23,42,0.84);
          border:1px solid rgba(255,255,255,0.12);
          color:#f8fafc;
          font-size:11px;
          font-weight:900;
          letter-spacing:0.16em;
          box-shadow:0 10px 18px rgba(15,23,42,0.2);
        }

        .hero-sidecopy{
          position:absolute;
          left:4px;
          bottom:10px;
          z-index:3;
          font-size:12px;
          font-weight:800;
          letter-spacing:0.18em;
          color:rgba(255,255,255,0.78);
          transform:rotate(-90deg) translateX(-18px);
          transform-origin:left bottom;
        }

        .home-grid{
          display:grid;
          grid-template-columns:repeat(2, minmax(0, 1fr));
          gap:18px;
        }

        .home-card{
          border:none;
          border-radius:28px;
          background:#ffffff;
          padding:24px 22px 20px;
          min-height:312px;
          display:flex;
          flex-direction:column;
          justify-content:space-between;
          text-align:left;
          cursor:pointer;
          transition:transform 0.22s ease, box-shadow 0.22s ease, border-color 0.22s ease;
          box-shadow:0 12px 26px rgba(15,23,42,0.08);
          border:1px solid rgba(219,234,254,0.78);
          position:relative;
          overflow:hidden;
        }

        .home-card::before{
          content:"";
          position:absolute;
          inset:auto -60px -70px auto;
          width:180px;
          height:180px;
          border-radius:50%;
          opacity:0.08;
          background:currentColor;
        }

        .home-card:hover{
          transform:translateY(-8px);
          box-shadow:0 22px 38px rgba(15,23,42,0.13);
        }

        .card-top{
          position:relative;
          z-index:2;
          display:flex;
          flex-direction:column;
          gap:14px;
        }

        .card-head{
          display:flex;
          align-items:flex-start;
          justify-content:space-between;
          gap:14px;
        }

        .card-icon{
          width:74px;
          height:74px;
          border-radius:24px;
          display:flex;
          align-items:center;
          justify-content:center;
          background:#eff6ff;
          color:#0f172a;
          font-size:15px;
          font-weight:900;
          letter-spacing:-0.03em;
          box-shadow:inset 0 1px 0 rgba(255,255,255,0.7);
        }

        .card-badge{
          display:inline-flex;
          align-items:center;
          min-height:28px;
          padding:0 10px;
          border-radius:999px;
          background:#f8fafc;
          border:1px solid #dbeafe;
          color:#64748b;
          font-size:11px;
          font-weight:900;
          letter-spacing:0.12em;
          text-transform:uppercase;
          white-space:nowrap;
        }

        .card-title{
          margin:0;
          font-size:40px;
          line-height:1;
          font-weight:900;
          letter-spacing:-0.04em;
        }

        .card-desc{
          font-size:16px;
          line-height:1.62;
          color:#334155;
          font-weight:700;
          max-width:540px;
        }

        .card-points{
          display:flex;
          flex-wrap:wrap;
          gap:8px;
          margin-top:2px;
        }

        .card-point{
          display:inline-flex;
          align-items:center;
          min-height:30px;
          padding:0 11px;
          border-radius:999px;
          background:#f8fafc;
          border:1px solid #dbeafe;
          color:#475569;
          font-size:12px;
          font-weight:800;
          white-space:nowrap;
        }

        .card-btn{
          position:relative;
          z-index:2;
          margin-top:18px;
          min-height:54px;
          border-radius:17px;
          display:flex;
          align-items:center;
          justify-content:center;
          font-size:17px;
          font-weight:900;
          color:#ffffff;
          box-shadow:0 12px 24px rgba(15,23,42,0.14);
        }

        .friendly{
          color:#2563eb;
        }
        .friendly .card-title{color:#2563eb;}
        .friendly .card-btn{background:linear-gradient(90deg,#3b82f6,#2563eb);}

        .tournament{
          color:#7c3aed;
        }
        .tournament .card-title{color:#7c3aed;}
        .tournament .card-btn{background:linear-gradient(90deg,#8b5cf6,#7c3aed);}

        .rivalry{
          color:#ea580c;
        }
        .rivalry .card-title{color:#ea580c;}
        .rivalry .card-btn{background:linear-gradient(90deg,#f97316,#ea580c);}

        .league{
          color:#059669;
        }
        .league .card-title{color:#059669;}
        .league .card-btn{background:linear-gradient(90deg,#10b981,#059669);}

        .home-credit{
          width:100%;
          margin-top:4px;
          display:flex;
          justify-content:center;
        }

        .home-credit-inner{
          display:inline-flex;
          align-items:center;
          min-height:38px;
          padding:0 18px;
          border-radius:999px;
          background:rgba(255,255,255,0.8);
          border:1px solid rgba(203,213,225,0.8);
          color:#475569;
          font-size:14px;
          font-weight:800;
          letter-spacing:-0.01em;
          box-shadow:0 8px 16px rgba(15,23,42,0.06);
        }

        @media (max-width:1100px){
          .hero-inner{
            grid-template-columns:1fr;
          }

          .hero-brand{
            font-size:56px;
          }

          .hero-title{
            font-size:24px;
          }
        }

        @media (max-width:760px){
          .home-grid{
            grid-template-columns:1fr;
          }
        }

        @media (max-width:640px){
          .home-hero{
            padding:24px 20px 26px;
          }

          .hero-visual{
            min-height:200px;
          }

          .hero-logo-wrap{
            width:172px;
            height:172px;
            border-radius:30px;
          }

          .hero-logo{
            width:132px;
          }

          .hero-brand{
            font-size:44px;
          }

          .hero-badge{
            font-size:10px;
            letter-spacing:0.12em;
          }

          .hero-sidecopy{
            display:none;
          }

          .home-card{
            min-height:294px;
            padding:20px 18px 18px;
          }

          .card-title{
            font-size:34px;
          }

          .card-desc{
            font-size:14px;
          }
        }
      `}</style>

      <div className="home-root">
        <div className="home-shell">
          <section className="home-hero">
            <div className="hero-inner">
              <div className="hero-copy">
                <div className="hero-badge">BADMONKEYZ MATCHING SYSTEM</div>
                <h1 className="hero-brand">BADMONKEYZ</h1>
                <h2 className="hero-title">배드민턴 경기 운영 시스템</h2>
                <div className="hero-subtitle">친선전 · 대회 · 대항전 · 정기전 모드를 한 화면에서 선택합니다</div>
                <div className="hero-desc">
                  운영 목적에 맞는 모드를 빠르게 고르고, 선수 등록부터 대진 생성, 점수 입력,
                  엑셀 출력까지 한 흐름으로 처리할 수 있도록 만든 배드민턴 운영 화면입니다.
                </div>
              </div>

              <div className="hero-visual">
                <div className="hero-orbit" />
                <div className="hero-stamp">YEAR OF THE MONKEY</div>
                <div className="hero-sidecopy">1980 BADMINTON</div>
                <div className="hero-logo-wrap">
                  <img src={monkeyzLogo} alt="BADMONKEYZ logo" className="hero-logo" />
                </div>
              </div>
            </div>
          </section>

          <section className="home-grid">
            {resolvedModes.map((mode) => (
              <button
                key={mode.key}
                className={`home-card ${mode.accent}`}
                onClick={() => handleSelect(mode.key)}
              >
                <div className="card-top">
                  <div className="card-head">
                    <div className="card-icon">{mode.icon}</div>
                    <div className="card-badge">{mode.badge}</div>
                  </div>
                  <h2 className="card-title">{mode.title}</h2>
                  <div className="card-desc">{mode.description}</div>
                  <div className="card-points">
                    {mode.highlights.map((point) => (
                      <span key={`${mode.key}-${point}`} className="card-point">
                        {point}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="card-btn">{mode.buttonText}</div>
              </button>
            ))}
          </section>

          <div className="home-credit">
            <div className="home-credit-inner">만든이 김정수</div>
          </div>
        </div>
      </div>
    </>
  );
}
