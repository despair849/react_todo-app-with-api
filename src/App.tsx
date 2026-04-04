/* eslint-disable jsx-a11y/label-has-associated-control */
import React, { useEffect, useRef, useState } from 'react';
import { UserWarning } from './UserWarning';
import * as todoService from './api/todos';
import { Todo } from './types/Todo';
import { USER_ID } from './constants';

enum Filter {
  All = 'all',
  Active = 'active',
  Completed = 'completed',
}

type FilterItem = {
  label: string;
  value: Filter;
  href: string;
  dataCy: string;
};

const filters: FilterItem[] = [
  {
    label: 'All',
    value: Filter.All,
    href: '#/',
    dataCy: 'FilterLinkAll',
  },
  {
    label: 'Active',
    value: Filter.Active,
    href: '#/active',
    dataCy: 'FilterLinkActive',
  },
  {
    label: 'Completed',
    value: Filter.Completed,
    href: '#/completed',
    dataCy: 'FilterLinkCompleted',
  },
];

export const App: React.FC = () => {
  // #region states
  const [todos, setTodos] = useState<Todo[]>([]);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<Filter>(Filter.All);
  const [title, setTitle] = useState('');
  const [tempTodo, setTempTodo] = useState<Todo | null>(null);
  const [processingIds, setProcessingIds] = useState<number[]>([]);
  const [editingTodoId, setEditingTodoId] = useState<number | null>(null);
  const [editingTitle, setEditingTitle] = useState('');
  // #endregion

  const allCompleted = todos.length > 0 && todos.every(todo => todo.completed);

  const inputRef = useRef<HTMLInputElement>(null);

  const visibleTodos = todos.filter(todo => {
    switch (filter) {
      case Filter.Active:
        return !todo.completed;
      case Filter.Completed:
        return todo.completed;
      default:
        return true;
    }
  });

  const activeTodos = todos.filter(todo => !todo.completed).length;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');

    const trimmedTitle = title.trim();

    if (!trimmedTitle) {
      setError('Title should not be empty');

      setTimeout(() => {
        setError('');
      }, 3000);

      return;
    }

    const newTempTodo: Todo = {
      id: 0,
      title: trimmedTitle,
      completed: false,
      userId: USER_ID,
    };

    setTempTodo(newTempTodo);

    try {
      const addedTodo = await todoService.addTodo(newTempTodo);

      setTodos(prev => [...prev, addedTodo]);
      setTempTodo(null);
      setTitle('');

      setTimeout(() => {
        inputRef.current?.focus();
      });
    } catch {
      setError('Unable to add a todo');
      setTempTodo(null);

      setTimeout(() => {
        inputRef.current?.focus();
      });

      setTimeout(() => {
        setError('');
      }, 3000);
    }
  };

  const handleDelete = async (id: number) => {
    setProcessingIds(prev => [...prev, id]);

    try {
      await todoService.deleteTodo(id);
      setTodos(prev => prev.filter(todo => todo.id !== id));

      setTimeout(() => {
        inputRef.current?.focus();
      });
    } catch {
      setError('Unable to delete a todo');

      setTimeout(() => {
        setError('');
      }, 3000);
    } finally {
      setProcessingIds(prev => prev.filter(pid => pid !== id));
    }
  };

  const handleClearCompleted = async () => {
    const completedTodos = todos.filter(todo => todo.completed);

    setProcessingIds(completedTodos.map(todo => todo.id));

    const results = await Promise.allSettled(
      completedTodos.map(todo => todoService.deleteTodo(todo.id)),
    );

    const failed = results
      .map((res, i) => ({ res, id: completedTodos[i].id }))
      .filter(r => r.res.status === 'rejected')
      .map(r => r.id);

    setTodos(prev =>
      prev.filter(todo => !todo.completed || failed.includes(todo.id)),
    );
    setProcessingIds(prev => prev.filter(id => failed.includes(id)));

    if (failed.length > 0) {
      setError('Unable to delete a todo');

      setTimeout(() => {
        setError('');
      }, 3000);
    }

    setTimeout(() => {
      inputRef.current?.focus();
    });
  };

  const handleToggle = async (todo: Todo) => {
    setProcessingIds(prev => [...prev, todo.id]);

    try {
      await todoService.updateTodo(todo.id, { completed: !todo.completed });
      setTodos(prev =>
        prev.map(t =>
          t.id === todo.id ? { ...t, completed: !t.completed } : t,
        ),
      );
    } catch {
      setError('Unable to update a todo');
    } finally {
      setProcessingIds(prev => prev.filter(id => id !== todo.id));
    }
  };

  const handleToggleAll = async () => {
    const newCompletedStatus = !allCompleted;

    const todosToUpdate = todos.filter(
      todo => todo.completed !== newCompletedStatus,
    );

    setProcessingIds(prev => [...prev, ...todosToUpdate.map(t => t.id)]);

    try {
      await Promise.all(
        todosToUpdate.map(todo =>
          todoService.updateTodo(todo.id, { completed: newCompletedStatus }),
        ),
      );

      setTodos(prev =>
        prev.map(todo =>
          todosToUpdate.some(t => t.id === todo.id)
            ? { ...todo, completed: newCompletedStatus }
            : todo,
        ),
      );
    } catch {
      setError('Unable to update todos');
    } finally {
      setProcessingIds(prev =>
        prev.filter(id => !todosToUpdate.some(t => t.id === id)),
      );
    }
  };

  const saveTodo = async (todo: Todo) => {
    const trimmedTitle = editingTitle.trim();

    if (!trimmedTitle) {
      handleDelete(todo.id);

      return;
    }

    if (trimmedTitle === todo.title) {
      setEditingTodoId(null);

      return;
    }

    setProcessingIds(prev => [...prev, todo.id]);

    try {
      await todoService.updateTodo(todo.id, { title: trimmedTitle });
      setTodos(prev =>
        prev.map(t => (t.id === todo.id ? { ...t, title: trimmedTitle } : t)),
      );
      setEditingTodoId(null);
    } catch {
      setError('Unable to update a todo');

      setTimeout(() => {
        setError('');
      }, 3000);
    } finally {
      setProcessingIds(prev => prev.filter(id => id !== todo.id));
    }
  };

  const handleKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement>,
    todo: Todo,
  ) => {
    if (e.key === 'Enter') {
      saveTodo(todo);
    } else if (e.key === 'Escape') {
      setEditingTodoId(null);
    }
  };

  useEffect(() => {
    todoService
      .getTodos(USER_ID)
      .then(setTodos)
      .catch(() => {
        setError('Unable to load todos');

        setTimeout(() => {
          setError('');
        }, 3000);
      });
  }, []);

  if (!USER_ID) {
    return <UserWarning />;
  }

  return (
    <div className="todoapp">
      <h1 className="todoapp__title">todos</h1>

      <div className="todoapp__content">
        <header className="todoapp__header">
          {todos.length > 0 && (
            <button
              type="button"
              className={`todoapp__toggle-all ${allCompleted ? 'active' : ''}`}
              data-cy="ToggleAllButton"
              onClick={handleToggleAll}
            />
          )}

          <form onSubmit={handleSubmit}>
            <input
              ref={inputRef}
              value={title}
              data-cy="NewTodoField"
              type="text"
              className="todoapp__new-todo"
              placeholder="What needs to be done?"
              onChange={event => setTitle(event.target.value)}
              autoFocus
              disabled={tempTodo !== null}
            />
          </form>
        </header>

        {(todos.length > 0 || tempTodo) && (
          <section className="todoapp__main" data-cy="TodoList">
            {visibleTodos.map(todo => {
              return (
                <div
                  key={todo.id}
                  data-cy="Todo"
                  className={`todo ${todo.completed ? 'completed' : ''}`}
                >
                  <label className="todo__status-label">
                    <input
                      data-cy="TodoStatus"
                      type="checkbox"
                      className="todo__status"
                      checked={todo.completed}
                      onChange={() => handleToggle(todo)}
                    />
                  </label>

                  {editingTodoId === todo.id ? (
                    <input
                      data-cy="TodoTitleField"
                      className="todo__title-field"
                      value={editingTitle}
                      placeholder="Empty todo will be deleted"
                      autoFocus
                      onChange={e => setEditingTitle(e.target.value)}
                      onBlur={() => saveTodo(todo)}
                      onKeyDown={e => handleKeyDown(e, todo)}
                    />
                  ) : (
                    <span
                      data-cy="TodoTitle"
                      className="todo__title"
                      onDoubleClick={() => {
                        setEditingTodoId(todo.id);
                        setEditingTitle(todo.title);
                      }}
                    >
                      {todo.title}
                    </span>
                  )}

                  {editingTodoId !== todo.id && (
                    <button
                      type="button"
                      className="todo__remove"
                      data-cy="TodoDelete"
                      onClick={() => handleDelete(todo.id)}
                    >
                      x
                    </button>
                  )}

                  <div
                    data-cy="TodoLoader"
                    className={`modal overlay ${processingIds.includes(todo.id) ? 'is-active' : ''}`}
                  >
                    {/* eslint-disable-next-line max-len */}
                    <div className="modal-background has-background-white-ter" />
                    <div className="loader" />
                  </div>
                </div>
              );
            })}
            {tempTodo && (
              <div data-cy="Todo" className="todo">
                <label className="todo__status-label">
                  <input
                    data-cy="TodoStatus"
                    className="todo__status"
                    type="checkbox"
                    checked={false}
                    readOnly
                  />
                </label>

                <span data-cy="TodoTitle" className="todo__title">
                  {tempTodo.title}
                </span>

                <div data-cy="TodoLoader" className="modal overlay is-active">
                  <div className="modal-background has-background-white-ter" />
                  <div className="loader" />
                </div>
              </div>
            )}
          </section>
        )}

        {todos.length > 0 && (
          <footer className="todoapp__footer" data-cy="Footer">
            <span className="todo-count" data-cy="TodosCounter">
              {activeTodos} items left
            </span>

            <nav className="filter" data-cy="Filter">
              {filters.map(item => (
                <a
                  key={item.value}
                  href={item.href}
                  className={`filter__link ${filter === item.value ? 'selected' : ''}`}
                  data-cy={item.dataCy}
                  onClick={() => setFilter(item.value)}
                >
                  {item.label}
                </a>
              ))}
            </nav>

            <button
              type="button"
              className="todoapp__clear-completed"
              data-cy="ClearCompletedButton"
              disabled={todos.filter(t => t.completed).length === 0}
              onClick={handleClearCompleted}
            >
              Clear completed
            </button>
          </footer>
        )}
      </div>

      <div
        data-cy="ErrorNotification"
        className={`notification is-danger is-light has-text-weight-normal ${!error ? 'hidden' : ''}`}
      >
        <button
          data-cy="HideErrorButton"
          type="button"
          className="delete"
          onClick={() => setError('')}
        />
        {error}
      </div>
    </div>
  );
};
