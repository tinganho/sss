
'use strict';

import { HTTP, HTTPOptions, ModelResponse, CollectionResponse } from './HTTP';
import { isArray, extend, deepEqual, clone, autobind, EventEmitter } from './Utils';

interface Map { [index: string]: string; }

interface Cookies {
    accessToken?: string;
    renewalToken?: string;
    userId?: string;
}

export interface RequestInfo<P, Q> {
    params: P;
    query: Q;
    cookies?: Cookies;
}

export const enum RelationType {
    HasOne,
    HasMany,
}

interface ModelRelation {
    type?: RelationType;
    includeProps?: string[];
    reverseProp: string;
    model: new(props?: ModelData) => Model<any>;
    collection?: new(collectionData?: any) => Collection<any>;
}

export interface ModelRelations {
    [property: string]: ModelRelation;
}

export abstract class DataStore extends EventEmitter {
    public HTTPSaveOptions: HTTPOptions;
    public HTTPFetchOptions: HTTPOptions;
    public HTTPDeleteOptions: HTTPOptions;
    public wasProvidedWithDataFromRouter: boolean;
    public isOwnedByMe = false;

    public static URL(URL: string) {
        return function(Ctor: Function) {
            (Ctor as any)._URL = URL;
        }
    }

    public static noParentURL(Ctor: Function) {
        (Ctor as any)._noParentURL = true;
    }

    public get isModel(): this is Model<any> {
        return false;
    }

    public setFetchOptions(options: HTTPOptions) {
        this.HTTPFetchOptions = options;
    }

    public onFetch(requestInfo: RequestInfo<any, any>) {
        if (inServer && requestInfo.cookies && requestInfo.cookies.accessToken) {
            this.setFetchOptions({
                accessToken: requestInfo.cookies.accessToken,
            });
        }
    }

    public onSave(options: HTTPOptions) {

    }
}

export interface Model {
    onFetch(requestInfo: RequestInfo<any, any>): void;
}

export abstract class Model<P> extends DataStore {
    'constructor': {
        _noParentURL: boolean;
        _noServer: boolean;
        _relations: ModelRelations;
        name: string;
        _URL: string;
    }

    public static relations(r: ModelRelations) {
        return function(Ctor: Function) {
            (Ctor as any)._relations = r;
        }
    }

    public static noServer(Ctor: Function) {
        (Ctor as any)._noServer = true;
    }

    public collection: Collection<Model<any>>;
    private _isNew = true;
    private _hasChanged: boolean;

    get isModel(): this is this {
        return true;
    }

    public props = {} as P & { id?: string, [index: string]: any };
    public previousProps = {} as P & { id?: string, [index: string]: any };

    constructor(props?: P, userId?: string) {
        super();
        if (props) {
            this.setProps(props, userId);
        }
    }

    public get hasChanged(): boolean {
        return this._hasChanged;
    }

    public get isNew(): boolean {
        return this._isNew;
    }

    public get(prop: string): any {
        let props = prop.split('.');
        if (props.length === 1) {
            return (this.props as any)[prop];
        }
        else {
            if (props.length > 2) {
                throw new TypeError('Property can not have more than two dots');
            }
            return (this.props as any)[props[0]].get(props[1]);
        }
    }

    private setRelations(prop: string, value: any) {
        let relation = this.constructor._relations[prop];
        (this.props as any)[prop].on('add', (model: any) => {
            this.emit('add:' + prop, model);
        });
        (this.props as any)[prop].on('delete', (model: any) => {
            this.emit('delete:' + prop, model);
        });
        (this.props as any)[prop].on('remove', (model: any) => {
            this.emit('remove:' + prop, model);
        });
        (this.props as any)[prop][relation.reverseProp] = this;
    }

    public set(props: any): this;
    public set(prop: string, value: any): this;
    public set(prop: any, value?: any): this {
        if (typeof prop === 'string') {
            let relations = this.constructor._relations;
            if (prop === 'id') {
                this._isNew = false;
            }
            if (relations && prop in relations) {
                if (relations[prop].type === RelationType.HasOne) {
                    let Model = relations[prop].model;
                    if (value instanceof Model) {
                        this.props[prop] = value;
                    }
                    else {
                        this.props[prop] = new Model(value);
                    }
                    this.setRelations(prop, value);
                }
                else {
                    let Collection = relations[prop].collection;
                    if (value instanceof Model) {
                        this.props[prop] = value;
                    }
                    else {
                        this.props[prop] = new Collection(value);
                    }
                    this.setRelations(prop, value);
                }
            }
            else {
                (this.props as any)[prop] = value;
            }

            if (!this.previousProps[prop] || this.previousProps[prop] !== this.props[prop]) {
                this.emit('change:' + prop, [this, value]);
                this.emit('change', [this, prop, value]);
                this._hasChanged = true;
            }

            if (!this._isNew) {
                this.previousProps = clone(this.props);
            }
        }
        else {
            this.setProps(prop);
        }

        return this;
    }

    private setProps(props: any, userId?: string) {
        let hasChanges = false;
        for (let p in props) {
            if (props.hasOwnProperty(p)) {
                let relations = this.constructor._relations;
                if (relations && p in relations) {
                    let value = props[p];
                    if (relations[p].type === RelationType.HasOne) {
                        let Model = relations[p].model;
                        if (value instanceof Model) {
                            this.props[p] = value;
                        }
                        else {
                            this.props[p] = new Model(value);
                        }
                        if (userId == props[p].userId) {
                            this.props[p].isOwnedByMe = true;
                        }
                    }
                    else {
                        let Collection = relations[p].collection;
                        if (value instanceof Collection) {
                            this.props[p] = value;
                        }
                        else {
                            this.props[p] = new Collection(value);
                        }
                        (this.props[p] as Collection<any>).forEach((model) => {
                            model.isOwnedByMe = userId == model.props.userId;
                        });
                    }
                    this.setRelations(p, props[p]);
                }
                else {
                    (this.props as any)[p] = props[p];
                    if (userId == (this.props as any).userId) {
                        this.isOwnedByMe = true;
                    }
                }

                if (!this.previousProps[p] || !deepEqual(this.previousProps[p], props[p])) {
                    this.emit('change:' + p, [this, props[p]]);
                    hasChanges = true;
                    this._hasChanged = true;
                }
            }
        }

        if (hasChanges) {
            this.emit('change', [this]);
        }

        if (props.id) {
            this.previousProps = clone(this.props);
            this._hasChanged = false;
            this._isNew = false;
        }
        else {
            this._isNew = true;
        }

        return this;
    }

    public setSaveOptions(options: HTTPOptions) {
        this.HTTPSaveOptions = options;
    }

    protected getModelURL(requestInfo?: RequestInfo<any, any>) {
        let URL: string;
        let constructor = this.constructor;
        let modelName = constructor.name.toLowerCase();
        if (constructor._URL) {
            URL = constructor._URL.replace(':id', this.props.id);
        }
        else {
            URL = '/' + modelName + 's/' + this.props.id;
        }
        return URL;
    }

    public add(relation: string, props: any): this {
        let URL = this.getModelURL();
        let collection = this.props[relation] as Collection<Model<any>>;
        collection.add(props);
        return this;
    }

    public fetch(requestInfo?: RequestInfo<any, any>, relations?: string[], parentURL?: string): Promise<any> {
        return new Promise<P>((resolve, reject) => {
            let constructor = this.constructor;
            let URL = this.getModelURL(requestInfo);
            if (!constructor._noParentURL && parentURL) {
                URL = parentURL + URL;
            }
            this.onFetch(requestInfo);
            if (inServer && requestInfo.cookies.accessToken) {
                if (!this.HTTPFetchOptions) {
                    this.HTTPFetchOptions = {};
                }
                this.HTTPFetchOptions.accessToken = requestInfo.cookies.accessToken;
            }
            let promises: Promise<any>[] = [];
            let relationData: any[] = [];
            if (!constructor._noServer) {
                let request = HTTP.get<ModelResponse<any>>(URL, this.HTTPFetchOptions);
                promises.push(request);
            }

            if (relations) {
                for (let r of relations) {
                    let props = {};
                    let data: any;
                    let dataType: string;
                    if (constructor._relations[r].type === RelationType.HasOne) {
                        data = new constructor._relations[r].model(props);
                    }
                    else {
                        data = new constructor._relations[r].collection(props);
                    }
                    relationData.push(data);
                    promises.push(data.fetch(requestInfo, null, URL));
                }
            }

            Promise.all(promises).then((results) => {
                let data: any = {};
                if (!this.constructor._noServer) {
                    data = results[0].body.model;
                }
                if (relations) {
                    for (let i = 0; i < relations.length; i++) {
                        data[relations[i]] = relationData[i];
                    }
                }
                this.setProps(data, requestInfo.cookies.userId);
                if (requestInfo.cookies && requestInfo.cookies.userId == data.userId) {
                    this.isOwnedByMe = true;
                }
                resolve();
            })
            .catch(reject);
        });
    }

    public save(): Promise<any>;
    public save(parentURL: string): Promise<any>;
    public save(newProps: Object): Promise<any>;
    public save(newProps: Object, parentURL: string): Promise<any>;
    public save(propsOrURL?: string | Object, parentURL?: string): Promise<any> {

        let newProps: Object;
        if (typeof propsOrURL === 'string') {
            parentURL = propsOrURL;
        }
        else {
            newProps = propsOrURL;
        }

        let promises: Promise<any>[] = [];
        if (!this.constructor._noServer && (this._isNew || newProps)) {
            let options = this.HTTPSaveOptions || {};
            if (!options.bodyType) {
                options.bodyType = HTTP.BodyType.MultipartFormData;
            }
            if (!options.body) {
                if (newProps) {
                    options.body = extend(newProps, this.toData());
                }
                else {
                    options.body = this.toData();
                }
            }
            this.onSave(options);
            let constructor = this.constructor as any;
            let modelName = constructor.name.toLowerCase();
            if (this._isNew) {
                let URL: string;
                if (constructor._URL) {
                    URL = constructor._URL;
                }
                else {
                    URL = '/' + modelName + 's';
                }
                if (!constructor.noParentURL && parentURL) {
                    URL = parentURL + URL;
                }

                promises.push(HTTP.post<any>(URL, options)
                    .then((response) => {
                        this.setProps(response.body.model);
                    }));
            }
            else {
                let URL = this.getModelURL();
                if (!constructor.noParentURL && parentURL) {
                    URL = parentURL + URL;
                }

                promises.push(HTTP.put<any>(URL, options)
                    .then((response) => {
                        this.setProps(response.body.model);
                    }));
            }
        }

        let relations = this.constructor._relations;
        for (let r in relations) {
            if (relations.hasOwnProperty(r)) {
                promises.push(this.props[r].save(this.getModelURL()));
            }
        }

        return Promise.all(promises);
    }

    public delete(onSuccess?: (emit: () => void) => void): Promise<void> {
        if (!this.constructor._noServer && !this.isNew) {
            let options = this.HTTPDeleteOptions || {};
            return HTTP.del(this.getModelURL(), options).then((response) => {
                if (onSuccess) {
                    let emit = () => {
                        this.emit('delete', [this.props.id]);
                    }
                    onSuccess(emit);
                }
                else {
                    this.emit('delete', [this.props.id]);
                }
            });
        }
        else {
            this.emit('delete', [this.props.id]);
            return Promise.resolve<void>();
        }
    }

    public decrement(prop: string, value: number = 1): void {
        this.set(prop, this.get(prop) - value);
    }

    public increment(prop: string, value: number = 1): void {
        this.set(prop, this.get(prop) + value);
    }

    public toData(props?: string[]): P {
        let result = {} as P;
        for (let p in this.props) {
            if (this.props.hasOwnProperty(p)) {
                if (props && !(props.indexOf(p) === -1)) {
                    continue;
                }
                let value = (this.props as any)[p];
                let relations = this.constructor._relations;
                if (relations && p in relations) {
                    (result as any)[p] = value.toData(relations[p].includeProps);
                }
                else {
                    (result as any)[p] = value;
                }
            }
        }
        return result;
    }
}

interface ModelData {
    id?: string;

    [index: string]: any;
}

function isModelInstance<T>(m: Model<T> | ModelData): m is Model<T> {
    return !!(m as Model<T>).props;
}

function isArrayOfModels(x: any): x is ModelData[] | Model<any>[] {
    return x instanceof Array;
}

export class Collection<M extends Model<any>> extends DataStore {
    "constructor": {
        Model: new(props?: ModelData) => M,
        _URL: string;
        _noParentURL: boolean;
        name: string;
    }

    public static model<T>(model: new() => Model<T>) {
        return function(Ctor: Function) {
            (Ctor as any).Model = model;
        }
    }

    private ids: string[] = [];
    private store: M[] = [];

    constructor(collection?: M[]) {
        super();
        if (collection) {
            for (let m of collection) {
                this.add(m);
            }
        }
    }

    public add(model: M | M[] | ModelData | ModelData[]) {
        if (isArrayOfModels(model)) {
            for (let m of model) {
                this.addModel(m);
            }
        }
        else {
            this.addModel(model as M | ModelData);
        }
    }

    private addModel(model: M | ModelData) {
        let id: string;
        if ((model as M).get) {
            id = (model as M).get('id');
        }
        else {
            id = (model as any).id;
        }
        if (id && this.ids.indexOf(id) !== -1) {
            throw new TypeError(`Model with id '${id}'' is already added`);
        }
        this.ids.push(id);
        if (!isModelInstance(model)) {
            model = new this.constructor.Model(model);
        }
        (model as M).collection = this;
        let m = model as M;
        this.store.push(m);
        m.on('change', (model, prop, value) => {
            this.emit('change', [model, prop, value]);
        });
        m.on('delete', this.remove);
        this.emit('add', [m]);
    }

    public get(id: string) {
        let index = this.ids.indexOf(id);
        if (index === -1) {
            throw new TypeError(`Could not get model with id '${id}'.`);
        }
        return this.store[index];
    }

    public at(index: number): M {
        return this.store[index];
    }

    @autobind
    public remove(id: string) {
        let index = this.ids.indexOf(id);
        this.ids.splice(index, 1);
        let model = this.store.splice(index, 1);
        this.emit('remove', [model]);
    }

    public fetch(requestInfo?: RequestInfo<any, any>, relations?: string[], parentURL?: string): Promise<M[]> {
        return new Promise<M[]>((resolve, reject) => {
            let URL: string;
            if (this.constructor._URL) {
                URL = this.constructor._URL;
            }
            else {
                URL = '/' + this.constructor.name.toLowerCase();
            }
            if (!this.constructor._noParentURL && parentURL) {
                URL = parentURL + URL;
            }
            this.onFetch(requestInfo);
            HTTP.get<CollectionResponse<any>>(URL, this.HTTPFetchOptions)
                .then((response) => {
                    this.add(response.body.collection);
                    resolve();
                })
                .catch(reject);
        });
    }

    public save(parentURL?: string): Promise<any>{
        let promises: Promise<any>[] = [];
        for (let model of this.store) {
            if (model.isNew) {
                promises.push(model.save(parentURL));
            }
        }

        return Promise.all(promises);
    }

    public forEach(callback: (model: M) => void) {
        for (let model of this.store) {
            callback(model);
        }
    }

    public get length() {
        return this.store.length;
    }

    public toData(props?: string[]): any[] {
        let collection: any[] = [];
        for (let m of this.store) {
            collection.push(m.toData())
        }

        return collection;
    }
}
