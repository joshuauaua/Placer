/* PLACER — About Page */

import aboutPhoto from '../assets/about-team.jpg';

export function AboutPage({ t }) {
  return (
    <div style={{
      width: '100%',
      height: '100%',
      overflowY: 'auto',
      background: t.page,
      padding: '40px 20px'
    }}>
      <div style={{ maxWidth: 480, margin: '0 auto' }}>
        <img
          src={aboutPhoto}
          alt="A Polaroid-style photo of the people behind PLACER gathered around a table at a restaurant, smiling towards the camera."
          style={{
            display: 'block',
            width: '100%',
            height: 'auto',
            borderRadius: 12
          }}
        />
        <p style={{
          marginTop: 24,
          fontSize: 18,
          lineHeight: 1.6,
          color: t.inkDim,
          textAlign: 'center'
        }}>
          Placer is developed by STPLN and Ankara Aks, funded by the Swedish Institute
        </p>
      </div>
    </div>
  );
}

export default AboutPage;
