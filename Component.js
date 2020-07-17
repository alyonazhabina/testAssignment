export class Component {
	static assoc = {};
	static EVENT_PREFIX = '@';
	static REACTIVE_PROP_PREFIX = ':';

	constructor(props = {}) {
		console.log('constructor function______________' + this.constructor);
		this.template_content = undefined;
		this.template_file = undefined;
		Object.assign((this.props = {}), props);
	}


	/**
	 *  Получить то this.template тестовую версию html документа и
	 *  с помощью DOMParser получить объект типа HTMLDocument
	 * @returns {Promise<any>} возвращает объект типа HTMLDocument
	 */
	get dom() {
		console.log('dom function______________');
		return new Promise((rv) => {
			this.template.then((template) => {
				console.log({template});
				rv(new DOMParser().parseFromString(template, "text/html"));
			});
		});
	}

	/**
	 * Отправляет GET запрос c  this.template_file на сервер,
	 * обрабатывает ответ, полученный в виде текста (resp.text),
	 * присваивает его this.template_content и разрешает template промис с rv(this.template_content)
	 *
	 * @returns {Promise<any>} представление html в виде текста (this.template_content)
	 */
	get template() {
		console.log('template function______________');
		return new Promise((rv) => {
			if (this.template_content) {
				rv(this.template_content);
				return;
			}
			this.template_file = this.template_file
				? this.template_file
				: "./" + this.constructor.name + ".html";
			fetch(this.template_file).then((resp) => {
				resp.text().then((text) => {
					this.template_content = text;
					console.log('type');
					console.log(typeof text)
					rv(this.template_content);
				});
			});
		});
	}

	/**
	 * Получить свойство по имени
	 *
	 * @param name имя свойства или метода
	 * @returns {Promise<*>} возвратить свойство или метод или undefined
	 * @private
	 */
	async _get(name) {
		console.log('_get function______________');
		if (typeof this.props[name] !== "undefined") return this.props[name];
		return this[name];
	}

	/**
	 * Получить свойство по имени
	 *
	 * @param name имя свойства или метода
	 * @returns {Promise<*>} возвратить свойство или метод или undefined
	 * @private
	 */
	async _get_value(name) {
		console.log('_get_value function______________');
		let r = await this._get(name);
		if (r === undefined) {
			try {
				r = JSON.parse(name);
				console.log('json parse');
				console.log(name);
				console.log(r);
			} catch (e_json) {
				try {
					r = eval(a.value);
				} catch (e_eval) {
				}
			}
		}
		return r;
	}

	/**
	 *	Получить обновлённую строку с заменой дефолтных значений
	 *
	 * @param s строка
	 * @returns {Promise<*>} возвратить обновлённую строку с соотствествующим значением вида:
	 * {{deafult_prop}} => current_prop
	 */
	async renderString(s) {
		console.log('renderString function______________');
		let off = 0;


		for (let m of Array.from(s.matchAll(/\{\{([^\}]*)\}\}/g))) {
			let [match, expr] = m;
			console.log({match, expr});
			s = s.replace(match, await this._get_value(expr));
		}
		return s;
	}

	/**
	 *  Получить список атрибутов узла в виде объекта
	 *
	 * @param node узел
	 * @returns {Promise<void>} возвратить список атрибутов узла в виде объекта
	 */
	async parseAttributes(node) {
		console.log('parseAttributes function______________');
		const attributes = node.attributes;
		const o = {};
		await Promise.all(
			Array.from(attributes).map(async (a) => {
				console.log('attributes = ');
				console.log(a)
				let name1 = a.name.slice(1);
				switch (a.name[0]) {
					case this.constructor.EVENT_PREFIX:
						// event
						(o._events || (o._events = {}))[name1] = await this._get(a.value);
						await this.addEventHandler(node, name1, o._events[name1])
						break;
					case this.constructor.REACTIVE_PROP_PREFIX:
						// reactive prop

						o[name1] = await this._get_value(a.value);
						console.log(this.constructor)
						console.log(name1 + " " + o[name1])
						await this.addAttribute(node, name1, o[name1], this.constructor.REACTIVE_PROP_PREFIX)
						break;
					default:
						// prop
						o[a.name] = a.value;
				}
			})
		);
		return o;
	}

	/**
	 * Обработать дочерние элементы узла-предка
	 * Если для дочернего узла в assoc есть соотвествущий файл для рендеринга,
	 * то вызывать на этот дочерний узел render
	 *
	 * @param parent узел
	 * @returns {Promise<void>}
	 */
	async renderChilds(parent) {
		console.log('renderChilds function______________');
		console.log('PARENT:');
		console.log(parent);
		console.log('this.props');
		console.log(this.props);
		console.log(this.constructor)
		for (let node of parent.childNodes) {
			console.log('node before')
			console.log(node)
			switch (node.nodeType) {
				case 1: // tag
					const tag = node.tagName.toLowerCase(),
						tag_class = this.constructor.assoc[tag],
						props = await this.parseAttributes(node);
					console.log('tag: ' + tag);
					console.log(node);

					console.log({tag, props});

					if (tag_class) {
						await new tag_class(props).render(node);
					} else {
						console.log({node});
						await this.renderChilds(node);

						//debugger;
					}
					break;
				case 3: // text
					node.nodeValue = await this.renderString(node.nodeValue);
					break;
			}
		}
	}

	/**
	 * Добавить аттрибут к узлу
	 *
	 * @param node узел
	 * @param attrName имя аттрибута
	 * @param attrValue значение аттрибута
	 * @param prefix  префикс (optional
	 * @returns {Promise<void>}
	 */
	async addAttribute(node, attrName, attrValue, prefix) {
		node.setAttribute(attrName, attrValue);
		await this.removeRelatedAttribute(node, attrName, prefix)
	}


	/**
	 * Добавить к узлу обработчика соответсвующего события
	 *
	 * @param node узел
	 * @param eventName имя события
	 * @param eventHandler обработчик
	 * @returns {Promise<void>}
	 */
	async addEventHandler(node, eventName, eventHandler) {
		console.log(event);
		console.log('addEventListener function______________');
		// for (let event in events) {
		node.addEventListener(eventName, eventHandler);
		await this.removeRelatedAttribute(node, eventName, this.constructor.EVENT_PREFIX)
		// }
	}

	/**
	 * Удалить аттрибут узла по имени аттрибута и префиксу
	 *
	 * @param node узел
	 * @param attrName имя аттрибута
	 * @param prefix префикс (optional)
	 * @returns {Promise<void>}
	 */
	async removeRelatedAttribute(node, attrName, prefix) {
		console.log('removeRelatedAttribute function______________');
		if (node && attrName) {
			node.removeAttribute((prefix || '') + attrName);
			console.log(`Attribute ${attrName} has been removed`);
		}
	}


	/**
	 * Заменить дочерний элемент основного элемента на дочерние элементы обработанного объекта body
	 *
	 * @param element, отвечающий за положение соотвествующего HTML документа на главное странице
	 * @param body обработанный объект (HTMLDocument)
	 * @returns {Promise<void>}
	 */
	async renderWithBody(element, body) {
		console.log('renderWithBody function______________');
		await this.renderChilds(body);
		console.log(body.childNodes)
		console.log('back to renderWithBody');
		console.log('DOCUMENT READY BEFORE');
		console.log(document.readyState);
		element.replaceWith(...Array.from(body.childNodes));
		console.log('DOCUMENT READY AFTEER');
		console.log(document.readyState);
	}

	/**
	 * Обработать соотвестсвующий HTML документ текущего класса
	 *
	 * @param element, отвечающий за положение соотвествующего HTML документы на главное странице
	 * @returns {Promise<void>}
	 */
	async render(element) {
		console.log('render function______________');
		const dom = await this.dom;
		console.log('DOCUMENT render before');
		console.log(document.readyState);
		await this.renderWithBody(element, dom.body);
		console.log('DOCUMENT render AFTEER');
		console.log(document.readyState);
	}
}
