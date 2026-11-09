import React,{useEffect,useState} from 'react';
import {COUNTRIES,countryTimezones,timezoneCountry} from '../geography.js';
import FilteredSelect from './FilteredSelect.jsx';
export default function CountryTimezoneSelect({value,onChange}) {
 const [country,setCountry]=useState(()=>timezoneCountry(value));
 useEffect(()=>{if(value&&!countryTimezones(country,value).includes(value))setCountry(timezoneCountry(value));},[value,country]);
 const zones=countryTimezones(country,value);
 return <div className="space-y-3"><FilteredSelect label="Timezone country" searchLabel="Search timezone countries" placeholder="Choose country or territory" value={country} onChange={code=>{setCountry(code);onChange('');}} options={[{value:'UTC',label:'UTC / Universal time'},...COUNTRIES.filter(c=>c.zones.length).map(c=>({value:c.code,label:c.name,keywords:c.keywords}))]}/><FilteredSelect label="Event timezone" searchLabel="Search timezones" placeholder="Choose event timezone" value={value} onChange={onChange} options={[...new Set([...zones,...(value?[value]:[])])].map(zone=>({value:zone,label:zone.replaceAll('_',' ')}))}/></div>;
}
