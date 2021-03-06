
import { map } from '../Library/Utils';

function isComposerDOMElement(element: Node | DOMElement): element is DOMElement {
    return !!(element as DOMElement).findOne;
}
export class DOMElement implements DOMElement {
    public nativeElement: HTMLElement;

    /**
     * Get element by id.
     */
    public static getElement(id: string) {
        let el = document.getElementById(id);
        if (!el) {
            return null;
        }
        return new DOMElement(el);
    }


    /**
     * Find elements by query.
     */
    public static findAll(query: string) {
        let elements: DOMElement[] = [];
        let nativeElements = document.querySelectorAll(query);
        for (let i = 0; i < nativeElements.length; i++) {
            elements.push(new DOMElement(nativeElements[i]));
        }

        return elements;
    }

    /**
     * Create element by id.
     */
    public static createElement(tag: string) {
        let el = document.createElement(tag);
        if (!el) {
            return null;
        }
        return new DOMElement(el);
    }

    constructor(element: Node | DOMElement | string) {
        if (typeof element === 'string') {
            this.nativeElement = document.createElement(element);
        }
        else if (isComposerDOMElement(element)) {
            this.nativeElement = element.nativeElement;
        }
        else {
            this.nativeElement = element as HTMLElement;
        }
    }

    public get id() {
        return this.nativeElement.id;
    }

    public set id(id: string) {
        this.nativeElement.id = id;
    }

    public getElement(id: string) {
        return this.findOne('#' + id);
    }

    public findOne(query: string): DOMElement {
        let el = this.nativeElement.querySelector(query);
        return el ? new DOMElement(el as HTMLElement) : null;
    }

    public findAll(query: string): DOMElement[] {
        let elements = this.nativeElement.querySelectorAll(query);
        return map(elements as any, (element: any) => {
            return new DOMElement(element as HTMLElement);
        });
    }

    public position(): { left: number, top: number } {
        let { left, top } = this.nativeElement.getBoundingClientRect();
        top = top + window.pageYOffset - this.nativeElement.ownerDocument.documentElement.clientTop;
        left = left + window.pageXOffset - this.nativeElement.ownerDocument.documentElement.clientLeft;
        return { left, top };
    }

    public getHeight(): number {
        let { height } = this.nativeElement.getBoundingClientRect();
        return height;
    }

    public getWidth(): number {
        let { width } = this.nativeElement.getBoundingClientRect();
        return width;
    }

    public getText(): string {
        return this.nativeElement.textContent;
    }

    public getAttribute(name: string): string {
        return this.nativeElement.getAttribute(name);
    }

    public setAttribute(name: string, value?: string): this {
        this.nativeElement.setAttribute(name, value);
        return this;
    }

    public removeAttribute(name: string): this {
        this.nativeElement.removeAttribute(name);
        return this;
    }

    public getHTML(): string {
        return this.nativeElement.innerHTML;
    }

    public setHTML(html: string): this {
        this.nativeElement.innerHTML = html;
        return this;
    }

    public append(element: DOMElement | JSX.Element | Node): this {
        let nativeElement = this.getNativeElement(element);
        this.nativeElement.appendChild(nativeElement as Node);
        return this;
    }

    public prepend(element: DOMElement | JSX.Element | Node): this {
        let nativeElement = this.getNativeElement(element);
        this.nativeElement.insertBefore(nativeElement, this.nativeElement.firstChild);
        return this;
    }

    public insertBefore(element: DOMElement | JSX.Element | Node): this {
        let nativeElement = this.getNativeElement(element);
        this.nativeElement.parentNode.insertBefore(nativeElement, this.nativeElement);
        return this;
    }

    public insertAfter(element: DOMElement | JSX.Element | Node): this {
        let nativeElement = this.getNativeElement(element);
        if (this.nativeElement.nextSibling) {
            this.nativeElement.parentNode.insertBefore(nativeElement, this.nativeElement.nextSibling);
        }
        else {
            this.nativeElement.parentNode.appendChild(nativeElement);
        }
        return this;
    }

    private getNativeElement(element: DOMElement | JSX.Element | Node): Node {
        if ((element as DOMElement).getFirstChildElement){
            return (element as DOMElement).nativeElement;
        }
        else if ((element as JSX.Element).resetComponent) {
            return (element as JSX.Element).toDOM().frag;
        }
        else {
            return element as Node;
        }
    }

    public hide(): this {
        this.nativeElement.style.display = 'none';
        return this;
    }

    public show(): this {
        this.nativeElement.style.display = '';
        return this;
    }

    public remove(): void {
        if (this.nativeElement.remove) {
            this.nativeElement.remove();
        }
        else {
            this.nativeElement.parentNode.removeChild(this.nativeElement);
        }
    }

    public addClass(className: string): this {
        this.nativeElement.classList.add(className);
        return this;
    }

    public removeClass(className: string): this {
        this.nativeElement.classList.remove(className);
        return this;
    }

    public setClass(className: string): this {
        this.nativeElement.className = className;
        return this;
    }

    public hasClass(className: string): boolean {
        return this.nativeElement.classList.contains(className);
    }

    public addEventListener(event: string, listener: EventListener): this {
        this.nativeElement.addEventListener(event, listener, false);
        return this;
    }

    public removeEventListener(event: string, listener: EventListener): this {
        this.nativeElement.removeEventListener(event, listener);
        return this;
    }

    public getClasses(): string[] {
        return this.nativeElement.className.split(' ');
    }

    public onClick(listener: EventListener): this {
        this.nativeElement.addEventListener('click', listener, false);
        return this;
    }

    public onDbClick(listener: EventListener): this {
        this.nativeElement.addEventListener('dbclick', listener, false);
        return this;
    }

    public onSubmit(listener: EventListener): this {
        this.nativeElement.addEventListener('submit', listener, false);
        return this;
    }

    public onFocus(listener: EventListener): this {
        this.nativeElement.addEventListener('focus', listener, false);
        return this;
    }

    public onBlur(listener: EventListener): this {
        this.nativeElement.addEventListener('blur', listener, false);
        return this;
    }

    public onTransitionEnd(callback: (...args: any[]) => any): this {
        let finish = () => {
            this.removeEventListener('transitionend', finish);
            this.removeEventListener('webkitTransitionEnd', finish);
            this.removeEventListener('oTransitionEnd', finish);
            this.removeEventListener('MSTransitionEnd', finish);
            callback();
        }
        this.addEventListener('transitionend', finish);
        this.addEventListener('webkitTransitionEnd', finish);
        this.addEventListener('oTransitionEnd', finish);
        this.addEventListener('MSTransitionEnd', finish);

        return this;
    }

    public clone(): DOMElement {
        return new DOMElement(this.nativeElement.cloneNode(true) as any);
    }

    public appendTo(target: DOMElement | HTMLElement | string): this {
        if (typeof target === 'string') {
            let element = DOMElement.getElement(target);
            element.append(this);
        }
        else if ((target as DOMElement).append){
            (target as DOMElement).append(this);
        }
        else {
            (target as HTMLElement).appendChild(this.nativeElement);
        }

        return this;
    }

    public prependTo(target: DOMElement | HTMLElement | string): this {
        if (typeof target === 'string') {
            let element = DOMElement.getElement(target);
            element.prepend(this);
        }
        else if ((target as DOMElement).append){
            (target as DOMElement).prepend(this);
        }
        else {
            (target as HTMLElement).insertBefore(this.nativeElement, (target as HTMLElement).firstChild);
        }

        return this;
    }

    public addStyle(rule: string, value: string): this {
        this.nativeElement.style.cssText += `${rule}: ${value};`;
        return this;
    }

    public setHeight(px: number): this {
        this.addStyle('height', px + 'px');
        return this;
    }

    public setWidth(px: number): this {
        this.addStyle('width', px + 'px');
        return this;
    }

    public getValue(): string {
        return (this.nativeElement as any).value;
    }

    public setValue(value: string): this {
        (this.nativeElement as any).value = value;
        return this;
    }

    public getParentElement(): DOMElement {
        return new DOMElement(this.nativeElement.parentElement);
    }

    public getFirstChildElement(): DOMElement {
        return new DOMElement(this.nativeElement.firstChild as HTMLElement);
    }

    public getStyle(rule: string): any {
        return (getComputedStyle(this.nativeElement) as any)[rule];
    }

    public getStyleInPixels(rule: string): number {
        return parseFloat(this.getStyle(rule).replace('px', ''));
    }

    public getChildren(): DOMElement[] {
        let children: DOMElement[] = [];
        for (let i = 0; i < this.nativeElement.childNodes.length; i++) {
            children.push(new DOMElement(this.nativeElement.childNodes[i] as HTMLElement));
        }
        return children;
    }

    public getPosition() {
        let { left, top } = this.nativeElement.getBoundingClientRect();
        return { left, top};
    }

    public getOffset() {
        return { left: this.nativeElement.offsetLeft, top: this.nativeElement.offsetTop };
    }
}