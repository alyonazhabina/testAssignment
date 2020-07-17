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

	get dom() {
		console.log('dom function______________');
		return new Promise((rv) => {
			this.template.then((template) => {
				console.log({template});
				rv(new DOMParser().parseFromString(template, "text/html"));
			});
		});
	}

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
	 *
	 * @param name
	 * @returns {Promise<*>}
	 * @private
	 */
	async _get(name) {
		console.log('_get function______________');
		if (typeof this.props[name] !== "undefined") return this.props[name];
		return this[name];
	}

	/**
	 *
	 * @param name
	 * @returns {Promise<*>}
	 * @private
	 */
	async _get_value(name) {
		console.log('_get_value function______________');
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
	 *
	 * @param s
	 * @returns {Promise<*>}
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
						await this.addEventHandler(node, name1,o._events[name1])
						break;
					case this.constructor.REACTIVE_PROP_PREFIX:
						// reactive prop

						o[name1] = await this._get_value(a.value);
						console.log(this.constructor)
						console.log(name1+" "+o[name1])
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
	 *
	 * @param parent
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

	async addAttribute(node, attrName, attrValue, prefix){
		node.setAttribute(attrName, attrValue);
		await this.removeRelatedAttribute(node, attrName, prefix)
	}


	async addEventHandler(node, eventName, eventHandler) {
		console.log(event);
		console.log('addEventListener function______________');
		// for (let event in events) {
			node.addEventListener(eventName, eventHandler);
			await this.removeRelatedAttribute(node, eventName, this.constructor.EVENT_PREFIX)
		// }
	}

	/**
	 * Удаляет аттрибут узла по имени аттрибута и префиксу
	 * @param node узел
	 * @param attrName имя аттрибута
	 * @param prefix префикс
	 * @returns {Promise<void>}
	 */
	async removeRelatedAttribute(node, attrName, prefix) {
		if (node && attrName) {
			node.removeAttribute((prefix || '') + attrName);
			console.log(`Attribute ${attrName} has been removed`);
		}
	}

	async renderWithBody(element, body) {
		await this.renderChilds(body);
		console.log(body.childNodes)
		element.replaceWith(...Array.from(body.childNodes));
	}

	async render(element) {
		const dom = await this.dom;
		await this.renderWithBody(element, dom.body);
	}
}
