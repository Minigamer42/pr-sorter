import '../style.css';
import { createRoot } from 'react-dom/client';
import { ActiveRoute } from 'active-route';
import {restoreRedirectedExternalSorterRoute} from './externalSorter/routing';
import { LibraryPlaylist } from './app/components/LibraryPlaylist';
import { libraryFilterFromUrl } from './app/libraryRouting';

restoreRedirectedExternalSorterRoute();

const root = createRoot(document.querySelector<HTMLElement>('#root')!);

const libraryFilter = libraryFilterFromUrl(window.location.href);
root.render(libraryFilter
    ? <LibraryPlaylist initialFilter={libraryFilter}/>
    : <ActiveRoute/>);
