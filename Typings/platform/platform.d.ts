
declare var inServer: boolean;
declare var inClient: boolean;
declare var cf: any;

declare type GetLocalization = (key: string, data?: any) => string;

interface Router {
    getQueryParam(name: string): string;
    navigateTo(route: string, state?: any): void;
}

declare module App {
    export let router: Router;
}