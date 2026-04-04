/* eslint-disable jsx-a11y/label-has-associated-control */
import React, { useEffect, useRef, useState } from 'react';
import { UserWarning } from './UserWarning';
import * as todoService from './api/todos';
import { Todo } from './types/Todo';
import { USER_ID } from './constants';
import { Header } from './components/Header';
import { TodoList } from './components/TodoList';

export enum Filter {
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
  // #endregion states
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

  // #region handlers
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
  // #endregion handlers

  return (
    <div className="todoapp">
      <h1 className="todoapp__title">todos</h1>

      <div className="todoapp__content">
        <Header
          todos={todos}
          setError={setError}
          title={title}
          setTitle={setTitle}
          setTempTodo={setTempTodo}
          setTodos={setTodos}
          inputRef={inputRef}
          tempTodo={tempTodo}
          setProcessingIds={setProcessingIds}
        />

        {(todos.length > 0 || tempTodo) && (
          <TodoList
            todos={visibleTodos}
            tempTodo={tempTodo}
            processingIds={processingIds}
            setTodos={setTodos}
            setProcessingIds={setProcessingIds}
            setError={setError}
            editingTodoId={editingTodoId}
            setEditingTodoId={setEditingTodoId}
            editingTitle={editingTitle}
            setEditingTitle={setEditingTitle}
            inputRef={inputRef}
          />
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
