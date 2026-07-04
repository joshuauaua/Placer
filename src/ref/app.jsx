/* PLOT — assemble the design canvas. */

function Board({ children }) {
  return <div style={{ width: '100%', height: '100%' }}>{children}</div>;
}

function App() {
  const bone = THEME.bone, ink = THEME.ink, signal = THEME.signal;
  const W = 1440, H = 900;
  return (
    <DesignCanvas>
      <DCSection id="flow" title="Core flow" subtitle="PLOT · Reimagine Your City — desktop, primary direction (Bone)">
        <DCArtboard id="home" label="1 · Map Home" width={W} height={H}><Board><MapHome t={bone} /></Board></DCArtboard>
        <DCArtboard id="search" label="2 · Search & Filter" width={W} height={H}><Board><SearchFilterScreen t={bone} /></Board></DCArtboard>
        <DCArtboard id="street" label="3 · Street View — place assets" width={W} height={H}><Board><StreetScreen t={bone} /></Board></DCArtboard>
        <DCArtboard id="create" label="4 · Create — describe & post" width={W} height={H}><Board><CreateScreen t={bone} /></Board></DCArtboard>
        <DCArtboard id="detail" label="5 · Imagination detail" width={W} height={H}><Board><DetailScreen t={bone} /></Board></DCArtboard>
      </DCSection>

      <DCSection id="directions" title="Visual directions" subtitle="Same Map Home, three editorial palettes — compare and pick one">
        <DCArtboard id="d-bone" label="A · Bone — paper + lime" width={W} height={H}><Board><MapHome t={bone} /></Board></DCArtboard>
        <DCArtboard id="d-ink" label="B · Ink — night map + lime" width={W} height={H}><Board><MapHome t={ink} /></Board></DCArtboard>
        <DCArtboard id="d-signal" label="C · Signal — electric blue" width={W} height={H}><Board><MapHome t={signal} /></Board></DCArtboard>
      </DCSection>
    </DesignCanvas>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
