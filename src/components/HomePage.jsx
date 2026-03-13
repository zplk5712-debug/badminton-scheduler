import React from "react";
import monkeyzLogo from "../assets/monkeyz-logo.jpg";

const MODES = [
  {
    key: "friendly",
    title: "친선전",
    icon: "🤝",
    description: "자유로운 클럽 경기 운영에 맞춘 밸런스 중심 자동 대진 생성",
    buttonText: "친선전 시작",
    accent: "friendly",
  },
  {
    key: "tournament",
    title: "대회",
    icon: "🏆",
    description: "대회 진행에 맞는 토너먼트형 경기 구성과 라운드 운영",
    buttonText: "대회 시작",
    accent: "tournament",
  },
  {
    key: "rivalry",
    title: "대항전",
    icon: "⚔️",
    description: "팀 대 팀 경기 흐름에 맞춘 공정한 대항전 대진 관리",
    buttonText: "대항전 시작",
    accent: "rivalry",
  },
  {
    key: "league",
    title: "정기전",
    icon: "📋",
    description: "정기 모임 운영에 적합한 리그형 경기 편성과 일정 관리",
    buttonText: "정기전 시작",
    accent: "league",
  },
];

export default function HomePage({ onSelectMode }) {
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
          max-width:1200px;
          margin:0 auto;
          display:flex;
          flex-direction:column;
          gap:28px;
        }

        /* HERO */

        .home-hero{
          position:relative;
          border-radius:32px;
          padding:36px 40px 44px;
          background:
            radial-gradient(circle at 15% 20%, rgba(59,130,246,0.20), transparent 28%),
            radial-gradient(circle at 85% 75%, rgba(96,165,250,0.18), transparent 32%),
            linear-gradient(135deg,#3b82f6 0%,#60a5fa 45%,#93c5fd 100%);
          color:white;
          overflow:hidden;
          box-shadow:0 18px 40px rgba(30,64,175,0.25);
        }

        .home-hero::after{
          content:"";
          position:absolute;
          inset:0;
          background:linear-gradient(90deg,rgba(255,255,255,0.10),rgba(255,255,255,0));
          pointer-events:none;
        }

        /* LOGO TOP LEFT */

        .hero-logo{
          position:absolute;
          top:20px;
          left:24px;
          width:90px;
          height:auto;
          opacity:0.95;
          filter:drop-shadow(0 6px 12px rgba(0,0,0,0.25));
        }

        /* CONTENT */

        .hero-inner{
          position:relative;
          z-index:2;
          display:flex;
          flex-direction:column;
          align-items:center;
          text-align:center;
          gap:12px;
        }

        .hero-badge{
          background:rgba(255,255,255,0.25);
          border:1px solid rgba(255,255,255,0.35);
          padding:8px 16px;
          border-radius:999px;
          font-size:12px;
          font-weight:800;
          letter-spacing:0.15em;
          backdrop-filter:blur(6px);
        }

        .hero-brand{
          margin:0;
          font-size:64px;
          font-weight:900;
          letter-spacing:-0.04em;
        }

        .hero-title{
          margin:0;
          font-size:28px;
          font-weight:800;
          opacity:0.95;
        }

        .hero-subtitle{
          margin-top:6px;
          font-size:22px;
          font-weight:800;
          color:#fbbf24;
        }

        .hero-desc{
          max-width:680px;
          font-size:16px;
          line-height:1.7;
          opacity:0.95;
        }

        /* MODE GRID */

        .home-grid{
          display:grid;
          grid-template-columns:repeat(4,1fr);
          gap:18px;
        }

        .home-card{
          border-radius:28px;
          padding:26px 22px 22px;
          min-height:360px;
          display:flex;
          flex-direction:column;
          justify-content:space-between;
          background:white;
          border:none;
          cursor:pointer;
          transition:0.25s;
          box-shadow:0 12px 26px rgba(0,0,0,0.08);
          text-align:left;
        }

        .home-card:hover{
          transform:translateY(-8px);
          box-shadow:0 20px 36px rgba(0,0,0,0.12);
        }

        .card-top{
          display:flex;
          flex-direction:column;
          gap:16px;
        }

        .card-icon{
          width:70px;
          height:70px;
          border-radius:20px;
          display:flex;
          align-items:center;
          justify-content:center;
          font-size:34px;
          background:#f1f5f9;
        }

        .card-title{
          font-size:38px;
          font-weight:900;
          margin:0;
        }

        .card-desc{
          font-size:16px;
          line-height:1.7;
          color:#475569;
        }

        .card-btn{
          margin-top:24px;
          padding:16px;
          border-radius:16px;
          font-weight:800;
          text-align:center;
          font-size:16px;
          color:white;
        }

        /* CARD COLORS */

        .friendly .card-title{color:#2563eb;}
        .friendly .card-btn{background:linear-gradient(90deg,#3b82f6,#2563eb);}

        .tournament .card-title{color:#7c3aed;}
        .tournament .card-btn{background:linear-gradient(90deg,#8b5cf6,#7c3aed);}

        .rivalry .card-title{color:#ea580c;}
        .rivalry .card-btn{background:linear-gradient(90deg,#f97316,#ea580c);}

        .league .card-title{color:#059669;}
        .league .card-btn{background:linear-gradient(90deg,#10b981,#059669);}

        /* MOBILE */

        @media (max-width:1000px){
          .home-grid{
            grid-template-columns:repeat(2,1fr);
          }

          .hero-brand{
            font-size:42px;
          }

          .hero-title{
            font-size:22px;
          }
        }

        @media (max-width:600px){
          .home-grid{
            grid-template-columns:1fr 1fr;
          }

          .hero-logo{
            width:70px;
          }
        }

      `}</style>

      <div className="home-root">
        <div className="home-shell">

          <section className="home-hero">

            <img src={monkeyzLogo} alt="logo" className="hero-logo" />

            <div className="hero-inner">

              <div className="hero-badge">
                BADMONKEYZ MATCHING SYSTEM
              </div>

              <h1 className="hero-brand">
                BADMONKEYZ
              </h1>

              <h2 className="hero-title">
                경기 운영 시스템
              </h2>

              <div className="hero-subtitle">
                친선전 · 대회 · 대항전 · 정기전 모드 선택
              </div>

              <div className="hero-desc">
                실제 동호회 운영 환경에 맞춰 경기 모드를 빠르게 선택하고,
                안정적으로 경기 운영을 시작할 수 있는 배드민턴 매칭 시스템입니다.
              </div>

            </div>

          </section>

          <section className="home-grid">

            {MODES.map((mode)=>(
              <button
                key={mode.key}
                className={`home-card ${mode.accent}`}
                onClick={()=>handleSelect(mode.key)}
              >

                <div className="card-top">

                  <div className="card-icon">
                    {mode.icon}
                  </div>

                  <h2 className="card-title">
                    {mode.title}
                  </h2>

                  <div className="card-desc">
                    {mode.description}
                  </div>

                </div>

                <div className="card-btn">
                  {mode.buttonText}
                </div>

              </button>
            ))}

          </section>

        </div>
      </div>
    </>
  );
}