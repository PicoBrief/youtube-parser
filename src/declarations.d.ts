declare module "xmldom" {
    export class DOMParser {
        parseFromString(source: string, mimeType: string): Document;
    }
}
