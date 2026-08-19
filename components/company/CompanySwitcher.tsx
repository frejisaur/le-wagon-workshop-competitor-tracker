'use client';

import {ComboBox} from '@carbon/react';
import type {CompanyTab} from './company-tab';
import styles from './company-switcher.module.scss';

export type CompanySwitcherOption = {
  companyId: string;
  identity: {domain: string; displayName?: string};
};

export function companyDestination(companyId: string, tab: CompanyTab): string {
  const path = `/companies/${encodeURIComponent(companyId)}`;
  return tab === 'overview' ? path : `${path}?tab=${tab}`;
}

export function CompanySwitcher({options, tab}: {options: CompanySwitcherOption[]; tab: CompanyTab}) {
  return <div className={`${styles.companySwitcher} company-switcher`}>
    <ComboBox
      id="company-switcher"
      items={options}
      itemToString={(item) => item ? item.identity.displayName ?? item.identity.domain : ''}
      titleText="Change company"
      placeholder="Search companies"
      selectedItem={null}
      onChange={({selectedItem}) => {
        if (selectedItem) window.location.assign(companyDestination(selectedItem.companyId, tab));
      }}
    />
  </div>;
}
