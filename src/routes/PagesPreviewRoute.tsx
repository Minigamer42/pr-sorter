import { SorterIndex } from '../sorterIndex/SorterIndex';
import {externalSorterRequestFromUrl} from '../externalSorter/routing';
import { CustomizeImportRoute } from './CustomizeImportRoute';
import {ExternalSorterRoute} from './ExternalSorterRoute';
import { ActiveRoute as SorterAppRoute } from './SorterAppRoute';

export function ActiveRoute() {
    const externalSorterRequest = externalSorterRequestFromUrl(window.location.href);
    if (externalSorterRequest) {
        return <ExternalSorterRoute request={externalSorterRequest}/>;
    }

    if (isCustomizeImportRoute()) {
        return <CustomizeImportRoute/>;
    }

    return isSorterRoute() ? <SorterAppRoute/> : <SorterIndex/>;
}

function isCustomizeImportRoute(): boolean {
    return window.location.pathname.replace(/\/+$/, '') === '/import';
}

function isSorterRoute(): boolean {
    const pathname = window.location.pathname.replace(/\/+$/, '');
    return pathname === '/test' || pathname.startsWith('/test/');
}
