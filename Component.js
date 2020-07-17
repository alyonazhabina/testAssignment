export class Component {
	static assoc = {};
	static EVENT_PREFIX = '@';
	static REACTIVE_PROP_PREFIX = ':';

	constructor(props = {}) {
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
		let r = await this._get(name);
		if (r === undefined) {
			try {
				r = JSON.parse(name);
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
	 *    Получить обновлённую строку с заменой дефолтных значений
	 *
	 * @param s строка
	 * @returns {Promise<*>} возвратить обновлённую строку с соотствествующим значением вида:
	 * {{deafult_prop}} => current_prop
	 */
	async renderString(s) {
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
		const attributes = node.attributes;
		const o = {};
		await Promise.all(
			Array.from(attributes).map(async (a) => {
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
		for (let node of parent.childNodes) {
			switch (node.nodeType) {
				case 1: // tag
					const tag = node.tagName.toLowerCase(),
						tag_class = this.constructor.assoc[tag],
						props = await this.parseAttributes(node);
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
	 * Добавить атрибут к узлу
	 *
	 * @param node узел
	 * @param attrName имя атрибута
	 * @param attrValue значение атрибута
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
		node.addEventListener(eventName, eventHandler);
		await this.removeRelatedAttribute(node, eventName, this.constructor.EVENT_PREFIX)
	}

	/**
	 * Удалить атрибут узла по имени атрибута и префиксу
	 *
	 * @param node узел
	 * @param attrName имя атрибута
	 * @param prefix префикс (optional)
	 * @returns {Promise<void>}
	 */
	async removeRelatedAttribute(node, attrName, prefix) {
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
		await this.renderChilds(body);
		;
		console.log(document.readyState);
		element.replaceWith(...Array.from(body.childNodes));
	}

	/**
	 * Обработать соотвестсвующий HTML документ текущего класса
	 *
	 * @param element, отвечающий за положение соотвествующего HTML документы на главное странице
	 * @returns {Promise<void>}
	 */
	async render(element) {
		const dom = await this.dom;
		await this.renderWithBody(element, dom.body);
	}
}
