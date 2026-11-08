import { useI18n } from '@sentinel/ui';
import { CirclePlay, ShieldCheck } from 'lucide-react';

const ONBOARDING_VIDEOS = [
  { id: 'customer-fleet-monitoring', audienceKey: 'admin.onboarding.customerAudience', titleKey: 'admin.onboarding.fleetTitle', descriptionKey: 'admin.onboarding.fleetDescription', duration: '23 sec' },
  { id: 'customer-location-sharing', audienceKey: 'admin.onboarding.customerResellerAudience', titleKey: 'admin.onboarding.sharingTitle', descriptionKey: 'admin.onboarding.sharingDescription', duration: '24 sec' },
  { id: 'reseller-customer-fleet', audienceKey: 'admin.onboarding.resellerAudience', titleKey: 'admin.onboarding.resellerTitle', descriptionKey: 'admin.onboarding.resellerDescription', duration: '22 sec' }
] as const;

export function OnboardingLibrary() {
  const { t } = useI18n();
  return <section className="onboarding-library" aria-labelledby="onboarding-library-title">
    <div className="onboarding-intro surface">
      <span className="onboarding-intro-icon" aria-hidden="true"><CirclePlay /></span>
      <div><p className="overline">{t('admin.onboarding.overline')}</p><h2 id="onboarding-library-title">{t('admin.onboarding.title')}</h2><p>{t('admin.onboarding.description')}</p></div>
    </div>
    <div className="onboarding-grid">
      {ONBOARDING_VIDEOS.map(video => <article className="surface onboarding-card" key={video.id}>
        <video controls preload="metadata" playsInline>
          <source src={`/onboarding/${video.id}.mp4`} type="video/mp4" />
          <track kind="captions" src={`/onboarding/${video.id}.vtt`} srcLang="en" label="English" default />
          {t('admin.onboarding.videoUnsupported')}
        </video>
        <div className="onboarding-card-copy"><div><span>{t(video.audienceKey)}</span><small>{video.duration}</small></div><h3>{t(video.titleKey)}</h3><p>{t(video.descriptionKey)}</p></div>
      </article>)}
    </div>
    <p className="onboarding-footnote"><ShieldCheck aria-hidden="true" />{t('admin.onboarding.privacyNote')}</p>
  </section>;
}
